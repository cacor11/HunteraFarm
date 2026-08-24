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
import br.com.hunterafarm.navigation.HunteraNavigationPolicy;
import br.com.hunterafarm.storage.AccountPreferences;

import java.util.Locale;

/**
 * Mobile player that keeps at most one game WebView alive. Every account uses a
 * dedicated AndroidX WebKit profile, keeping cookies and storage isolated.
 */
public final class MainActivity extends ComponentActivity {
    private static final String WEBVIEW_PACKAGE = "com.google.android.webview";
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
    private Button supportButton;

    private AccountPreferences accountPreferences;
    private AccountSlotManager slotManager;
    private boolean supportsMultipleProfiles;
    private boolean activityDestroyed;
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
        supportsMultipleProfiles = supportsMultipleProfilesSafely();
        slotManager = new AccountSlotManager(
                supportsMultipleProfiles ? AccountSlotManager.MAX_PROFILE_SLOTS : 1,
                accountPreferences.loadActiveSlots(),
                accountPreferences.loadSelectedSlot()
        );

        setupActions();
        setupBackNavigation();
        persistSlotState();
        renderAccountControls();

        if (!supportsMultipleProfiles) {
            compatibilityBanner.setVisibility(View.VISIBLE);
            compatibilityBanner.post(this::showCompatibilityDialog);
        }

        openSelectedAccount();
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
                openSelectedAccount();
            }
        });

        addAccountButton.setOnClickListener(view -> addAccount());
        closeAccountButton.setOnClickListener(view -> confirmCloseSelectedAccount());
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

        saveRenderedLocation();
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
        saveRenderedLocation();
        if (!slotManager.remove(slot)) {
            Toast.makeText(this, R.string.minimum_account, Toast.LENGTH_SHORT).show();
            return;
        }

        // The WebKit Profile is deliberately not deleted: only its live WebView
        // is destroyed, which frees RAM while keeping the account login on disk.
        destroyActiveWebView();
        persistSlotState();
        renderAccountControls();
        openSelectedAccount();
    }

    private void selectAccount(int slot) {
        if (slot == renderedSlot && activeWebView != null) {
            return;
        }

        saveRenderedLocation();
        if (!slotManager.select(slot)) {
            return;
        }

        persistSlotState();
        renderAccountControls();
        openSelectedAccount();
    }

    private void openSelectedAccount() {
        int slot = slotManager.getSelectedSlot();
        openAccount(slot, accountPreferences.loadLastUrl(slot));
    }

    private void openAccount(int slot, String requestedUrl) {
        destroyActiveWebView();
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

            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            );
            webViewContainer.addView(webView, 0, params);

            String safeUrl = HunteraNavigationPolicy.isEmbeddedUrlAllowed(requestedUrl)
                    ? requestedUrl
                    : HunteraNavigationPolicy.HOME_URL;
            webView.loadUrl(safeUrl);
        } catch (RuntimeException exception) {
            if (webView != null) {
                if (webView.getParent() == webViewContainer) {
                    webViewContainer.removeView(webView);
                }
                destroyWebViewInstance(webView);
            }
            activeWebView = null;
            renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;
            showEngineError();
        }

        renderActionButtons();
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
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND, true);
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOWNLOAD_FAVICONS_ENABLED)) {
            WebSettingsCompat.setDownloadFaviconsEnabled(settings, false);
        }

        CookieManager cookieManager = cookieManagerFor(webView);
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new HunteraWebViewClient(slot));
        webView.setWebChromeClient(new HunteraChromeClient(slot));
        webView.setDownloadListener((url, userAgent, disposition, mimeType, size) ->
                openExternalUrl(url, true)
        );
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

    private void saveRenderedLocation() {
        if (activeWebView == null || renderedSlot == AccountSlotManager.NO_SLOT_AVAILABLE) {
            return;
        }

        String currentUrl = activeWebView.getUrl();
        accountPreferences.saveLastUrl(renderedSlot, currentUrl);
    }

    private void destroyActiveWebView() {
        WebView webView = activeWebView;
        activeWebView = null;
        renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;
        if (webView == null) {
            return;
        }

        if (webView.getParent() == webViewContainer) {
            webViewContainer.removeView(webView);
        }
        destroyWebViewInstance(webView);
    }

    private void destroyWebViewInstance(WebView webView) {
        try {
            webView.stopLoading();
            webView.onPause();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.removeAllViews();
            webView.destroy();
        } catch (RuntimeException ignored) {
            // Destruction is best-effort if Android already killed the renderer.
        }
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

    private boolean handleMainFrameNavigation(String url) {
        if (HunteraNavigationPolicy.isEmbeddedUrlAllowed(url)) {
            return false;
        }

        openExternalUrl(url, true);
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

    private void showEngineError() {
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
                .setPositiveButton(R.string.retry, (dialog, which) -> openSelectedAccount())
                .show();
    }

    private void handleRendererGone(WebView webView, int slot, boolean didCrash) {
        if (webView != activeWebView) {
            destroyWebViewInstance(webView);
            return;
        }

        activeWebView = null;
        renderedSlot = AccountSlotManager.NO_SLOT_AVAILABLE;
        if (webView.getParent() == webViewContainer) {
            webViewContainer.removeView(webView);
        }
        destroyWebViewInstance(webView);
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
                        openSelectedAccount();
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
            return handleMainFrameNavigation(request.getUrl().toString());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleMainFrameNavigation(url);
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            if (view != activeWebView) {
                return;
            }

            // shouldOverrideUrlLoading is not invoked for every POST request.
            // Re-check the committed main-frame URL so an external redirect can
            // never remain rendered inside the authenticated Huntera profile.
            if (!HunteraNavigationPolicy.isEmbeddedUrlAllowed(url)) {
                view.stopLoading();
                loadingProgress.setVisibility(View.GONE);
                openExternalUrl(url, true);
                view.loadUrl(accountPreferences.loadLastUrl(slot));
                return;
            }

            statusText.setText(getString(R.string.loading_account, slot));
            loadingProgress.setVisibility(View.VISIBLE);
            accountPreferences.saveLastUrl(slot, url);
            renderActionButtons();
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (view != activeWebView) {
                return;
            }
            if (!HunteraNavigationPolicy.isEmbeddedUrlAllowed(url)) {
                return;
            }
            loadingProgress.setProgress(100);
            loadingProgress.setVisibility(View.GONE);
            statusText.setText(getString(R.string.account_ready, slot));
            accountPreferences.saveLastUrl(slot, url);
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
        if (activeWebView != null) {
            activeWebView.onResume();
            activeWebView.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        saveRenderedLocation();
        if (activeWebView != null) {
            activeWebView.onPause();
            activeWebView.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        activityDestroyed = true;
        saveRenderedLocation();
        destroyActiveWebView();
        super.onDestroy();
    }
}
