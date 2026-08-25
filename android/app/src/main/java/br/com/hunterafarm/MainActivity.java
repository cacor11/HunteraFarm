package br.com.hunterafarm;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import br.com.hunterafarm.accounts.AccountSlotManager;
import br.com.hunterafarm.analytics.AnonymousUsageReporter;
import br.com.hunterafarm.navigation.HunteraNavigationPolicy;
import br.com.hunterafarm.storage.AccountPreferences;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Mobile player that keeps one live WebView per open account. Every account
 * uses a dedicated AndroidX WebKit profile, keeping cookies and storage isolated.
 */
public final class MainActivity extends ComponentActivity {
    private static final String WEBVIEW_PACKAGE = "com.google.android.webview";
    private static final String WEBVIEW_STATE = "hunterafarm_webview_state";
    private static final String WEBVIEW_STATE_SLOT = "hunterafarm_webview_state_slot";
    private static final String MANUAL_RELOAD_SLOTS = "hunterafarm_manual_reload_slots";
    private static final int WEBVIEW_STATE_MAX_BYTES = 64 * 1024;
    private static final String PIX_PAYLOAD = "00020101021126580014br.gov.bcb.pix01369d2f23e4-d823-4a79-a3aa-545b4b6d3e9a5204000053039865802BR5922ACACIO SANTOS DA SILVA6010POCO VERDE62070503***6304638F";

    private FrameLayout webViewContainer;
    private View rootLayout;
    private View headerBar;
    private LinearLayout accountTabs;
    private TextView statusText;
    private TextView compatibilityBanner;
    private TextView emptyMessage;
    private ProgressBar loadingProgress;
    private Button backButton;
    private Button reloadButton;
    private Button addAccountButton;
    private Button closeAccountButton;
    private Button usageStatsButton;
    private Button supportButton;

    private AccountPreferences accountPreferences;
    private AnonymousUsageReporter usageReporter;
    private AccountSlotManager slotManager;
    private boolean supportsMultipleProfiles;
    private boolean activityDestroyed;
    private final Map<Integer, WebView> accountWebViews = new LinkedHashMap<>();
    private final Set<Integer> manualReloadSlots = new HashSet<>();
    private WebView activeWebView;
    private int renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bindViews();
        setupSystemBarInsets();
        applyCompactChrome(getResources().getConfiguration());
        accountPreferences = new AccountPreferences(this);
        usageReporter = new AnonymousUsageReporter(getApplicationContext());
        supportsMultipleProfiles = supportsMultipleProfilesSafely();
        slotManager = new AccountSlotManager(
                supportsMultipleProfiles ? AccountSlotManager.MAX_PROFILE_SLOTS : 1,
                accountPreferences.loadActiveSlots(),
                accountPreferences.loadSelectedSlot()
        );
        restoreManualReloadSlots(savedInstanceState);

        setupActions();
        setupBackNavigation();
        persistSlotState();
        renderAccountControls();

        if (!supportsMultipleProfiles) {
            compatibilityBanner.setVisibility(View.VISIBLE);
            compatibilityBanner.post(this::showCompatibilityDialog);
        }

        openSelectedAccount(savedInstanceState);
    }

    private void bindViews() {
        rootLayout = findViewById(R.id.rootLayout);
        webViewContainer = findViewById(R.id.webViewContainer);
        headerBar = findViewById(R.id.headerBar);
        accountTabs = findViewById(R.id.accountTabs);
        statusText = findViewById(R.id.statusText);
        compatibilityBanner = findViewById(R.id.compatibilityBanner);
        emptyMessage = findViewById(R.id.emptyMessage);
        loadingProgress = findViewById(R.id.loadingProgress);
        backButton = findViewById(R.id.backButton);
        reloadButton = findViewById(R.id.reloadButton);
        addAccountButton = findViewById(R.id.addAccountButton);
        closeAccountButton = findViewById(R.id.closeAccountButton);
        usageStatsButton = findViewById(R.id.usageStatsButton);
        supportButton = findViewById(R.id.supportButton);
    }

    private void setupSystemBarInsets() {
        if (Build.VERSION.SDK_INT < 35) {
            return;
        }
        rootLayout.setOnApplyWindowInsetsListener((view, windowInsets) -> {
            android.graphics.Insets bars = windowInsets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
            );
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
        rootLayout.requestApplyInsets();
    }

    private void applyCompactChrome(Configuration configuration) {
        headerBar.setVisibility(
                configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
                        ? View.GONE
                        : View.VISIBLE
        );
    }

    private void setupActions() {
        backButton.setOnClickListener(view -> {
            if (activeWebView != null && activeWebView.canGoBack()) {
                activeWebView.goBack();
            }
        });

        reloadButton.setOnClickListener(view -> {
            if (activeWebView != null) {
                activeWebView.reload();
            } else {
                forceOpenSelectedAccount();
            }
        });

        addAccountButton.setOnClickListener(view -> addAccount());
        closeAccountButton.setOnClickListener(view -> confirmCloseSelectedAccount());
        usageStatsButton.setOnClickListener(view -> showUsagePrivacyDialog());
        supportButton.setOnClickListener(view -> showSupportDialog());
        compatibilityBanner.setOnClickListener(view -> showCompatibilityDialog());
    }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (activeWebView != null && activeWebView.canGoBack()) {
                    activeWebView.goBack();
                    return;
                }

                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    private boolean supportsMultipleProfilesSafely() {
        try {
            return WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE);
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private void addAccount() {
        if (!supportsMultipleProfiles) {
            showCompatibilityDialog();
            return;
        }

        int addedSlot = slotManager.addAccount();
        if (addedSlot == AccountSlotManager.NO_SLOT_AVAILABLE) {
            Toast.makeText(this, R.string.maximum_accounts, Toast.LENGTH_SHORT).show();
            return;
        }

        persistSlotState();
        renderAccountControls();
        openAccount(addedSlot, accountPreferences.loadLastUrl(addedSlot));
    }

    private void confirmCloseSelectedAccount() {
        if (!slotManager.canRemove()) {
            Toast.makeText(this, R.string.minimum_account, Toast.LENGTH_SHORT).show();
            return;
        }

        int slot = slotManager.getSelectedSlot();
        new AlertDialog.Builder(this)
                .setTitle(getString(R.string.close_title, slot))
                .setMessage(R.string.close_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.close_screen, (dialog, which) -> closeAccount(slot))
                .show();
    }

    private void closeAccount(int slot) {
        if (!slotManager.remove(slot)) {
            Toast.makeText(this, R.string.minimum_account, Toast.LENGTH_SHORT).show();
            return;
        }

        // Closing a screen is the explicit RAM-saving action. Its WebKit
        // profile remains on disk so the account login can be reused later.
        destroyWebViewForSlot(slot);
        manualReloadSlots.remove(slot);
        persistSlotState();
        renderAccountControls();
        openSelectedAccount();
    }

    private void selectAccount(int slot) {
        if (slot == renderedSlot && activeWebView != null) {
            return;
        }

        if (!slotManager.select(slot)) {
            return;
        }

        persistSlotState();
        renderAccountControls();
        openSelectedAccount();
    }

    private void openSelectedAccount() {
        openSelectedAccount(null, false);
    }

    private void openSelectedAccount(Bundle savedInstanceState) {
        openSelectedAccount(savedInstanceState, false);
    }

    private void forceOpenSelectedAccount() {
        openSelectedAccount(null, true);
    }

    private void openSelectedAccount(Bundle savedInstanceState, boolean forceReload) {
        int slot = slotManager.getSelectedSlot();
        Bundle webViewState = null;
        if (savedInstanceState != null
                && savedInstanceState.getInt(
                        WEBVIEW_STATE_SLOT,
                        AccountSlotManager.NO_SLOT_AVAILABLE
                ) == slot) {
            webViewState = savedInstanceState.getBundle(WEBVIEW_STATE);
        }
        openAccount(
                slot,
                accountPreferences.loadLastUrl(slot),
                webViewState,
                forceReload
        );
    }

    private void openAccount(int slot, String requestedUrl) {
        openAccount(slot, requestedUrl, null, false);
    }

    private void openAccount(
            int slot,
            String requestedUrl,
            Bundle webViewState,
            boolean forceReload
    ) {
        WebView existingWebView = accountWebViews.get(slot);
        if (existingWebView != null) {
            manualReloadSlots.remove(slot);
            activateAccountWebView(slot, existingWebView);
            return;
        }

        if (manualReloadSlots.contains(slot) && !forceReload) {
            showManualReloadState(slot);
            return;
        }

        manualReloadSlots.remove(slot);
        hideActiveWebView();
        emptyMessage.setVisibility(View.GONE);
        statusText.setText(getString(R.string.loading_account, slot));
        loadingProgress.setProgress(0);
        loadingProgress.setVisibility(View.VISIBLE);

        WebView webView = null;
        try {
            webView = new WebView(this);

            // Android requires profile assignment before touching settings,
            // navigation, JavaScript, or clients on this WebView.
            // Account 1 intentionally keeps WebKit's Default profile. This lets
            // a user who started in one-account fallback mode retain that login
            // after updating WebView; accounts 2-4 use named isolated profiles.
            assignProfileIfSupported(webView, slot);

            activeWebView = webView;
            renderedSlot = slot;
            configureGameWebView(webView, slot);
            accountWebViews.put(slot, webView);

            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            );
            webViewContainer.addView(webView, 0, params);

            String safeUrl = HunteraNavigationPolicy.isEmbeddedUrlAllowed(requestedUrl)
                    ? requestedUrl
                    : HunteraNavigationPolicy.HOME_URL;
            boolean restored = false;
            if (webViewState != null) {
                try {
                    restored = webView.restoreState(webViewState) != null;
                } catch (RuntimeException ignored) {
                    // A stale system snapshot must never prevent a clean reopen.
                }
            }
            if (!restored) {
                webView.loadUrl(safeUrl);
            }
        } catch (RuntimeException exception) {
            accountWebViews.remove(slot);
            if (webView != null) {
                if (webView.getParent() == webViewContainer) {
                    webViewContainer.removeView(webView);
                }
                destroyWebViewInstance(webView);
            }
            if (webView == activeWebView) {
                activeWebView = null;
                renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;
            }
            showEngineError(slot);
        }

        renderActionButtons();
    }

    private void activateAccountWebView(int slot, WebView webView) {
        hideActiveWebView();
        activeWebView = webView;
        renderedSlot = slot;
        webView.setVisibility(View.VISIBLE);
        webView.requestFocus();
        emptyMessage.setVisibility(View.GONE);

        int progress = webView.getProgress();
        loadingProgress.setProgress(progress);
        if (progress >= 100) {
            loadingProgress.setVisibility(View.GONE);
            statusText.setText(getString(R.string.account_ready, slot));
        } else {
            loadingProgress.setVisibility(View.VISIBLE);
            statusText.setText(getString(R.string.loading_progress, slot, progress));
        }
        renderActionButtons();
    }

    private void hideActiveWebView() {
        if (activeWebView != null) {
            activeWebView.setVisibility(View.GONE);
        }
        activeWebView = null;
        renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;
    }

    private void setGlobalWebViewTimersPaused(boolean paused) {
        // pauseTimers/resumeTimers affect every WebView in this process. Any
        // managed instance can host the single global call, including a hidden
        // account when the selected slot is waiting for a manual reload.
        for (WebView webView : new ArrayList<>(accountWebViews.values())) {
            try {
                if (paused) {
                    webView.pauseTimers();
                } else {
                    webView.resumeTimers();
                }
                return;
            } catch (RuntimeException ignored) {
                // A renderer may be disappearing before its callback arrives;
                // try the next account rather than freezing every remaining one.
            }
        }
    }

    private void configureGameWebView(WebView webView, int slot) {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setGeolocationEnabled(false);
        // With multiple-window support disabled, target=_blank navigations are
        // safely routed through this same WebView and its existing profile.
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
            // Hidden account screens must keep their renderer priority so a
            // normal tab switch does not recreate and reload their pages.
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND, false);
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOWNLOAD_FAVICONS_ENABLED)) {
            WebSettingsCompat.setDownloadFaviconsEnabled(settings, false);
        }

        CookieManager cookieManager = cookieManagerFor(webView);
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new HunteraWebViewClient(slot));
        webView.setWebChromeClient(new HunteraChromeClient(slot));
        webView.setDownloadListener((url, userAgent, disposition, mimeType, size) -> {
            if (accountWebViews.get(slot) == webView && webView == activeWebView) {
                openExternalUrl(url, true);
            }
        });
    }

    @SuppressLint("RequiresFeature")
    private void assignProfileIfSupported(WebView webView, int slot) {
        if (supportsMultipleProfiles && slot > 1) {
            WebViewCompat.setProfile(webView, profileName(slot));
        }
    }

    @SuppressLint("RequiresFeature")
    private CookieManager cookieManagerFor(WebView webView) {
        if (supportsMultipleProfiles) {
            return WebViewCompat.getProfile(webView).getCookieManager();
        }
        return CookieManager.getInstance();
    }

    private void destroyWebViewForSlot(int slot) {
        WebView webView = accountWebViews.remove(slot);
        if (webView == null) {
            return;
        }

        if (webView == activeWebView) {
            activeWebView = null;
            renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;
        }
        if (webView.getParent() == webViewContainer) {
            webViewContainer.removeView(webView);
        }
        destroyWebViewInstance(webView);
    }

    private void destroyAllWebViews() {
        ArrayList<WebView> webViews = new ArrayList<>(accountWebViews.values());
        accountWebViews.clear();
        activeWebView = null;
        renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;

        for (WebView webView : webViews) {
            if (webView.getParent() == webViewContainer) {
                webViewContainer.removeView(webView);
            }
            destroyWebViewInstance(webView);
        }
    }

    private void destroyWebViewInstance(WebView webView) {
        try {
            webView.setWebChromeClient(null);
        } catch (RuntimeException ignored) {
            // Continue: each cleanup step is independent after renderer loss.
        }
        try {
            webView.setWebViewClient(null);
        } catch (RuntimeException ignored) {
            // Continue: each cleanup step is independent after renderer loss.
        }
        try {
            webView.setDownloadListener(null);
        } catch (RuntimeException ignored) {
            // Continue: each cleanup step is independent after renderer loss.
        }
        try {
            webView.stopLoading();
        } catch (RuntimeException ignored) {
            // Continue: the renderer may already be gone.
        }
        try {
            webView.onPause();
        } catch (RuntimeException ignored) {
            // Continue: the renderer may already be gone.
        }
        try {
            webView.removeAllViews();
        } catch (RuntimeException ignored) {
            // Continue: destroy must still be attempted.
        }
        try {
            webView.destroy();
        } catch (RuntimeException ignored) {
            // Destruction is best-effort if Android already killed the renderer.
        }
    }

    private void stopUnexpectedExternalNavigation(WebView webView, int slot, String url) {
        if (accountWebViews.get(slot) != webView) {
            return;
        }

        boolean wasActive = webView == activeWebView;
        accountWebViews.remove(slot);
        manualReloadSlots.add(slot);
        if (wasActive) {
            activeWebView = null;
            renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;
        }
        if (webView.getParent() == webViewContainer) {
            webViewContainer.removeView(webView);
        }
        destroyWebViewInstance(webView);

        if (!wasActive) {
            return;
        }

        loadingProgress.setVisibility(View.GONE);
        statusText.setText(getString(R.string.external_navigation_stopped, slot));
        emptyMessage.setText(R.string.external_navigation_help);
        emptyMessage.setVisibility(View.VISIBLE);
        renderActionButtons();

        // The account is intentionally not loaded again here. Reloading the
        // previous page can recreate the same redirect and cause an endless
        // refresh loop. The user remains in control through Atualizar.
        openExternalUrl(url, true);
    }

    private void restoreManualReloadSlots(Bundle savedInstanceState) {
        if (savedInstanceState == null) {
            return;
        }

        int[] savedSlots = savedInstanceState.getIntArray(MANUAL_RELOAD_SLOTS);
        if (savedSlots == null) {
            return;
        }

        for (int slot : savedSlots) {
            if (slotManager.getActiveSlots().contains(slot)) {
                manualReloadSlots.add(slot);
            }
        }
    }

    private void showManualReloadState(int slot) {
        hideActiveWebView();
        manualReloadSlots.add(slot);
        loadingProgress.setVisibility(View.GONE);
        statusText.setText(getString(R.string.manual_reload_waiting, slot));
        emptyMessage.setText(R.string.manual_reload_help);
        emptyMessage.setVisibility(View.VISIBLE);
        renderActionButtons();
    }

    private void renderAccountControls() {
        accountTabs.removeAllViews();
        int selectedSlot = slotManager.getSelectedSlot();
        Button selectedButton = null;

        for (int slot : slotManager.getActiveSlots()) {
            Button tab = new Button(this);
            tab.setAllCaps(false);
            tab.setGravity(Gravity.CENTER);
            tab.setMinHeight(dp(44));
            tab.setMinWidth(dp(96));
            tab.setPadding(dp(14), 0, dp(14), 0);
            tab.setText(getString(R.string.account_label, slot));
            tab.setTextSize(13f);
            tab.setTextColor(Color.WHITE);
            tab.setContentDescription(getString(R.string.account_label, slot));
            tab.setSelected(slot == selectedSlot);
            tab.setBackgroundTintList(ColorStateList.valueOf(getColor(
                    slot == selectedSlot ? R.color.accent_dark : R.color.surface_raised
            )));

            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    dp(44)
            );
            params.setMarginStart(dp(4));
            params.setMarginEnd(dp(4));
            accountTabs.addView(tab, params);

            int accountSlot = slot;
            tab.setOnClickListener(view -> selectAccount(accountSlot));
            if (slot == selectedSlot) {
                selectedButton = tab;
            }
        }

        Button finalSelectedButton = selectedButton;
        if (finalSelectedButton != null) {
            accountTabs.post(() -> {
                View parent = (View) accountTabs.getParent();
                if (parent instanceof HorizontalScrollView) {
                    ((HorizontalScrollView) parent).smoothScrollTo(finalSelectedButton.getLeft(), 0);
                }
            });
        }

        renderActionButtons();
    }

    private void renderActionButtons() {
        backButton.setEnabled(activeWebView != null && activeWebView.canGoBack());
        reloadButton.setEnabled(slotManager != null);
        addAccountButton.setEnabled(supportsMultipleProfiles && slotManager.canAdd());
        closeAccountButton.setEnabled(slotManager.canRemove());
        renderUsageStatsButton();
    }

    private void renderUsageStatsButton() {
        boolean enabled = usageReporter.isEnabled();
        usageStatsButton.setText(enabled ? R.string.usage_on_short : R.string.usage_off_short);
        usageStatsButton.setContentDescription(getString(
                enabled
                        ? R.string.usage_enabled_description
                        : R.string.usage_disabled_description
        ));
    }

    private void persistSlotState() {
        accountPreferences.saveSlots(
                slotManager.getActiveSlots(),
                slotManager.getSelectedSlot()
        );
    }

    private String profileName(int slot) {
        return String.format(Locale.ROOT, "hunterafarm_account_%d", slot);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private boolean handleMainFrameNavigation(WebView webView, int slot, String url) {
        if (HunteraNavigationPolicy.isEmbeddedUrlAllowed(url)) {
            return false;
        }

        // A background account must never interrupt the account currently on
        // screen. Its external navigation is blocked while the page stays live.
        if (accountWebViews.get(slot) == webView && webView == activeWebView) {
            openExternalUrl(url, true);
        }
        return true;
    }

    private void openExternalUrl(String rawUrl, boolean showConfirmation) {
        if (rawUrl == null) {
            return;
        }

        Uri uri = Uri.parse(rawUrl);
        String scheme = uri.getScheme();
        if (scheme == null
                || !(scheme.equalsIgnoreCase("https")
                || scheme.equalsIgnoreCase("http")
                || scheme.equalsIgnoreCase("mailto")
                || scheme.equalsIgnoreCase("tel"))) {
            Toast.makeText(this, R.string.external_failed, Toast.LENGTH_SHORT).show();
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            startActivity(intent);
            if (showConfirmation) {
                Toast.makeText(this, R.string.external_opened, Toast.LENGTH_SHORT).show();
            }
        } catch (ActivityNotFoundException exception) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show();
        }
    }

    private void openWebViewStore() {
        String packageName = WEBVIEW_PACKAGE;
        try {
            PackageInfo currentProvider = WebViewCompat.getCurrentWebViewPackage(this);
            if (currentProvider != null) {
                packageName = currentProvider.packageName;
            }
        } catch (RuntimeException ignored) {
            // Keep the standard Android System WebView package as a safe fallback.
        }

        Intent marketIntent = new Intent(
                Intent.ACTION_VIEW,
                Uri.parse("market://details?id=" + packageName)
        );
        try {
            startActivity(marketIntent);
        } catch (ActivityNotFoundException exception) {
            openExternalUrl(
                    "https://play.google.com/store/apps/details?id=" + packageName,
                    false
            );
        }
    }

    private void showSupportDialog() {
        if (isFinishing() || activityDestroyed) {
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.support_title)
                .setMessage(R.string.support_message)
                .setNegativeButton(R.string.close_dialog, null)
                .setPositiveButton(R.string.copy_pix, (dialog, which) -> copyPix())
                .show();
    }

    private void showUsagePrivacyDialog() {
        if (isFinishing() || activityDestroyed) {
            return;
        }

        boolean enabled = usageReporter.isEnabled();
        new AlertDialog.Builder(this)
                .setTitle(R.string.usage_privacy_title)
                .setMessage(
                        enabled
                                ? R.string.usage_privacy_enabled_message
                                : R.string.usage_privacy_disabled_message
                )
                .setNegativeButton(R.string.close_dialog, null)
                .setPositiveButton(
                        enabled ? R.string.disable_counting : R.string.enable_counting,
                        (dialog, which) -> {
                            usageReporter.setEnabled(!enabled);
                            renderUsageStatsButton();
                            Toast.makeText(
                                    this,
                                    enabled
                                            ? R.string.usage_disabled_confirmation
                                            : R.string.usage_enabled_confirmation,
                                    Toast.LENGTH_SHORT
                            ).show();
                        }
                )
                .show();
    }

    private void copyPix() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null) {
            Toast.makeText(this, R.string.copy_failed, Toast.LENGTH_SHORT).show();
            return;
        }
        clipboard.setPrimaryClip(ClipData.newPlainText(getString(R.string.pix_label), PIX_PAYLOAD));
        Toast.makeText(this, R.string.pix_copied, Toast.LENGTH_SHORT).show();
    }

    private void showCompatibilityDialog() {
        if (isFinishing() || activityDestroyed) {
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.fallback_title)
                .setMessage(R.string.fallback_message)
                .setNegativeButton(R.string.continue_one_account, null)
                .setPositiveButton(R.string.update_now, (dialog, which) -> openWebViewStore())
                .show();
    }

    private void showEngineError(int slot) {
        manualReloadSlots.add(slot);
        loadingProgress.setVisibility(View.GONE);
        statusText.setText(R.string.engine_error_message);
        emptyMessage.setText(R.string.engine_error_message);
        emptyMessage.setVisibility(View.VISIBLE);
        renderActionButtons();

        if (isFinishing() || activityDestroyed) {
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.engine_error_title)
                .setMessage(R.string.engine_error_message)
                .setNegativeButton(R.string.update_now, (dialog, which) -> openWebViewStore())
                .setPositiveButton(R.string.retry, (dialog, which) -> {
                    if (slotManager.getSelectedSlot() == slot) {
                        forceOpenSelectedAccount();
                    }
                })
                .show();
    }

    private void handleRendererGone(WebView webView, int slot, boolean didCrash) {
        if (accountWebViews.get(slot) != webView) {
            if (webView.getParent() instanceof ViewGroup) {
                ((ViewGroup) webView.getParent()).removeView(webView);
            }
            destroyWebViewInstance(webView);
            return;
        }

        boolean wasActive = webView == activeWebView;
        accountWebViews.remove(slot);
        manualReloadSlots.add(slot);
        if (wasActive) {
            activeWebView = null;
            renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;
        }
        if (webView.getParent() == webViewContainer) {
            webViewContainer.removeView(webView);
        }
        destroyWebViewInstance(webView);

        if (!wasActive) {
            return;
        }

        loadingProgress.setVisibility(View.GONE);
        renderActionButtons();

        if (didCrash) {
            statusText.setText(getString(R.string.renderer_crashed, slot));
            emptyMessage.setText(R.string.renderer_crashed_help);
            emptyMessage.setVisibility(View.VISIBLE);
            showRendererCrashDialog(slot);
            return;
        }

        statusText.setText(getString(R.string.renderer_released, slot));
        emptyMessage.setText(R.string.renderer_released_help);
        emptyMessage.setVisibility(View.VISIBLE);
        renderActionButtons();
    }

    private void showRendererCrashDialog(int slot) {
        if (isFinishing() || activityDestroyed) {
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.renderer_crashed_title)
                .setMessage(R.string.renderer_crashed_help)
                .setNegativeButton(R.string.close_dialog, null)
                .setPositiveButton(R.string.retry, (dialog, which) -> {
                    if (slotManager.getSelectedSlot() == slot) {
                        forceOpenSelectedAccount();
                    }
                })
                .show();
    }

    private final class HunteraWebViewClient extends WebViewClient {
        private final int slot;

        private HunteraWebViewClient(int slot) {
            this.slot = slot;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) {
                return false;
            }
            return handleMainFrameNavigation(view, slot, request.getUrl().toString());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleMainFrameNavigation(view, slot, url);
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            if (accountWebViews.get(slot) != view) {
                return;
            }

            // shouldOverrideUrlLoading is not invoked for every POST request.
            // Re-check the committed main-frame URL so an external redirect can
            // never remain rendered inside the authenticated Huntera profile.
            if (!HunteraNavigationPolicy.isEmbeddedUrlAllowed(url)) {
                stopUnexpectedExternalNavigation(view, slot, url);
                return;
            }

            if (view != activeWebView) {
                return;
            }
            statusText.setText(getString(R.string.loading_account, slot));
            loadingProgress.setVisibility(View.VISIBLE);
            renderActionButtons();
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (accountWebViews.get(slot) != view) {
                return;
            }
            if (!HunteraNavigationPolicy.isEmbeddedUrlAllowed(url)) {
                return;
            }
            accountPreferences.saveLastUrl(slot, url);
            if (view != activeWebView) {
                return;
            }
            loadingProgress.setProgress(100);
            loadingProgress.setVisibility(View.GONE);
            statusText.setText(getString(R.string.account_ready, slot));
            renderActionButtons();
        }

        @Override
        public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
        ) {
            if (view == activeWebView
                    && request.isForMainFrame()
                    && HunteraNavigationPolicy.isEmbeddedUrlAllowed(
                            request.getUrl().toString()
                    )) {
                loadingProgress.setVisibility(View.GONE);
                statusText.setText(R.string.load_failed);
                renderActionButtons();
            }
        }

        @Override
        @SuppressLint("NewApi")
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // This callback and RenderProcessGoneDetail only exist on API 26+;
            // Android never dispatches it on the app's API 24-25 devices.
            handleRendererGone(view, slot, detail.didCrash());
            return true;
        }
    }

    private final class HunteraChromeClient extends WebChromeClient {
        private final int slot;

        private HunteraChromeClient(int slot) {
            this.slot = slot;
        }

        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            if (view != activeWebView) {
                return;
            }
            loadingProgress.setProgress(newProgress);
            if (newProgress < 100) {
                loadingProgress.setVisibility(View.VISIBLE);
                statusText.setText(getString(R.string.loading_progress, slot, newProgress));
            }
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            request.deny();
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(
                String origin,
                GeolocationPermissions.Callback callback
        ) {
            callback.invoke(origin, false, false);
        }

    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyCompactChrome(newConfig);
    }

    @Override
    protected void onResume() {
        super.onResume();
        usageReporter.onActivityForegrounded();
        for (WebView webView : new ArrayList<>(accountWebViews.values())) {
            try {
                webView.onResume();
            } catch (RuntimeException ignored) {
                // onRenderProcessGone will quarantine an unusable instance.
            }
        }
        setGlobalWebViewTimersPaused(false);
    }

    @Override
    protected void onPause() {
        usageReporter.onActivityBackgrounded();
        setGlobalWebViewTimersPaused(true);
        for (WebView webView : new ArrayList<>(accountWebViews.values())) {
            try {
                webView.onPause();
            } catch (RuntimeException ignored) {
                // onRenderProcessGone will quarantine an unusable instance.
            }
        }
        super.onPause();
    }

    @Override
    @SuppressLint("RequiresFeature")
    protected void onSaveInstanceState(Bundle outState) {
        if (!manualReloadSlots.isEmpty()) {
            int[] savedManualSlots = new int[manualReloadSlots.size()];
            int index = 0;
            for (int slot : manualReloadSlots) {
                savedManualSlots[index++] = slot;
            }
            outState.putIntArray(MANUAL_RELOAD_SLOTS, savedManualSlots);
        }

        if (activeWebView != null
                && renderedSlot != AccountSlotManager.NO_SLOT_AVAILABLE) {
            Bundle webViewState = new Bundle();
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.SAVE_STATE)) {
                    WebViewCompat.saveState(
                            activeWebView,
                            webViewState,
                            WEBVIEW_STATE_MAX_BYTES,
                            false
                    );
                    outState.putBundle(WEBVIEW_STATE, webViewState);
                    outState.putInt(WEBVIEW_STATE_SLOT, renderedSlot);
                }
            } catch (RuntimeException ignored) {
                // The last completed Huntera URL remains a safe fallback.
            }
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        activityDestroyed = true;
        usageReporter.destroy();
        destroyAllWebViews();
        super.onDestroy();
    }
}
