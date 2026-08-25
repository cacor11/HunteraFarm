package br.com.hunterafarm.analytics;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URL;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.HttpsURLConnection;

/**
 * Sends a minimal anonymous heartbeat while the activity is in the foreground.
 * It never reads WebView state, account data, URLs, cookies, or game content.
 */
public final class AnonymousUsageReporter {
    // Public endpoint that receives only installation_id, platform, and version.
    public static final String HEARTBEAT_ENDPOINT =
            "https://hunterafarm-stats.yacaciio.workers.dev/heartbeat";

    private static final long HEARTBEAT_INTERVAL_SECONDS = 60L;
    private static final int NETWORK_TIMEOUT_MILLIS = 2_500;

    private final Object lock = new Object();
    private final UsagePreferences preferences;
    private final String installationId;
    private final String appVersion;
    private final ScheduledThreadPoolExecutor executor;

    private boolean enabled;
    private boolean foreground;
    private boolean destroyed;
    private long generation;
    private ScheduledFuture<?> scheduledHeartbeat;
    private HttpsURLConnection activeConnection;

    public AnonymousUsageReporter(Context context) {
        preferences = new UsagePreferences(context.getApplicationContext());
        installationId = preferences.getOrCreateInstallationId();
        appVersion = readAppVersion(context.getApplicationContext());
        enabled = preferences.isEnabled();
        executor = new ScheduledThreadPoolExecutor(1, runnable -> {
            Thread thread = new Thread(runnable, "HunteraFarm-Anonymous-Usage");
            thread.setPriority(Thread.MIN_PRIORITY);
            return thread;
        });
        executor.setRemoveOnCancelPolicy(true);
        executor.setExecuteExistingDelayedTasksAfterShutdownPolicy(false);
        executor.setContinueExistingPeriodicTasksAfterShutdownPolicy(false);
    }

    public boolean isEnabled() {
        synchronized (lock) {
            return enabled;
        }
    }

    public void setEnabled(boolean newEnabled) {
        preferences.setEnabled(newEnabled);
        synchronized (lock) {
            if (destroyed || enabled == newEnabled) {
                return;
            }
            enabled = newEnabled;
            if (newEnabled) {
                scheduleIfNeededLocked();
            } else {
                cancelHeartbeatLocked();
            }
        }
    }

    /** Starts reporting immediately and then about once per minute. */
    public void onActivityForegrounded() {
        synchronized (lock) {
            if (destroyed) {
                return;
            }
            foreground = true;
            scheduleIfNeededLocked();
        }
    }

    /** Stops future heartbeats and disconnects an in-flight request. */
    public void onActivityBackgrounded() {
        synchronized (lock) {
            foreground = false;
            cancelHeartbeatLocked();
        }
    }

    public void destroy() {
        synchronized (lock) {
            if (destroyed) {
                return;
            }
            destroyed = true;
            foreground = false;
            cancelHeartbeatLocked();
        }
        executor.shutdownNow();
    }

    private void scheduleIfNeededLocked() {
        if (!enabled || !foreground || destroyed || scheduledHeartbeat != null) {
            return;
        }

        long scheduledGeneration = ++generation;
        scheduledHeartbeat = executor.scheduleWithFixedDelay(
                () -> sendHeartbeat(scheduledGeneration),
                0L,
                HEARTBEAT_INTERVAL_SECONDS,
                TimeUnit.SECONDS
        );
    }

    private void cancelHeartbeatLocked() {
        generation++;
        if (scheduledHeartbeat != null) {
            scheduledHeartbeat.cancel(true);
            scheduledHeartbeat = null;
        }
        if (activeConnection != null) {
            activeConnection.disconnect();
            activeConnection = null;
        }
    }

    private boolean isRequestAllowed(long requestGeneration) {
        synchronized (lock) {
            return enabled
                    && foreground
                    && !destroyed
                    && generation == requestGeneration;
        }
    }

    private void sendHeartbeat(long requestGeneration) {
        if (!isRequestAllowed(requestGeneration)) {
            return;
        }

        HttpsURLConnection connection = null;
        try {
            URL endpoint = new URL(HEARTBEAT_ENDPOINT);
            if (!"https".equalsIgnoreCase(endpoint.getProtocol())) {
                return;
            }

            connection = (HttpsURLConnection) endpoint.openConnection();
            connection.setConnectTimeout(NETWORK_TIMEOUT_MILLIS);
            connection.setReadTimeout(NETWORK_TIMEOUT_MILLIS);
            connection.setRequestMethod("POST");
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "HunteraFarm/" + appVersion);

            byte[] body = UsageHeartbeatPayload.create(
                    installationId,
                    appVersion
            );
            connection.setFixedLengthStreamingMode(body.length);

            synchronized (lock) {
                if (!isRequestAllowed(requestGeneration)) {
                    connection.disconnect();
                    return;
                }
                activeConnection = connection;
            }

            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
                output.flush();
            }
            connection.getResponseCode();
        } catch (IOException | RuntimeException ignored) {
            // Counting must never interrupt the game or show network errors.
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
            synchronized (lock) {
                if (activeConnection == connection) {
                    activeConnection = null;
                }
            }
        }
    }

    @SuppressWarnings("deprecation")
    private static String readAppVersion(Context context) {
        try {
            PackageInfo packageInfo = context.getPackageManager().getPackageInfo(
                    context.getPackageName(),
                    0
            );
            String versionName = packageInfo.versionName;
            return versionName == null || versionName.isEmpty() ? "unknown" : versionName;
        } catch (PackageManager.NameNotFoundException | RuntimeException ignored) {
            return "unknown";
        }
    }
}
