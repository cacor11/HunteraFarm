package br.com.hunterafarm.analytics;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.UUID;

/** Private preferences used only by the anonymous installation counter. */
final class UsagePreferences {
    private static final String FILE_NAME = "hunterafarm_anonymous_usage";
    private static final String INSTALLATION_ID = "installation_id";
    private static final String ENABLED = "enabled";

    private final SharedPreferences preferences;

    UsagePreferences(Context context) {
        preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE);
    }

    boolean isEnabled() {
        return preferences.getBoolean(ENABLED, true);
    }

    void setEnabled(boolean enabled) {
        preferences.edit().putBoolean(ENABLED, enabled).apply();
    }

    String getOrCreateInstallationId() {
        String storedId = preferences.getString(INSTALLATION_ID, null);
        if (isValidUuid(storedId)) {
            return storedId;
        }

        String generatedId = UUID.randomUUID().toString();
        preferences.edit().putString(INSTALLATION_ID, generatedId).apply();
        return generatedId;
    }

    private boolean isValidUuid(String value) {
        if (value == null) {
            return false;
        }
        try {
            return UUID.fromString(value).toString().equals(value);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
