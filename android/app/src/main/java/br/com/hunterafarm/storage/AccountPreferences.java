package br.com.hunterafarm.storage;

import android.content.Context;
import android.content.SharedPreferences;

import br.com.hunterafarm.navigation.HunteraNavigationPolicy;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/** Small, private preference store; WebKit itself persists each profile's cookies. */
public final class AccountPreferences {
    private static final String FILE_NAME = "hunterafarm_accounts";
    private static final String ACTIVE_SLOTS = "active_slots";
    private static final String SELECTED_SLOT = "selected_slot";
    private static final String LAST_URL_PREFIX = "last_url_";

    private final SharedPreferences preferences;

    public AccountPreferences(Context context) {
        preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE);
    }

    public List<Integer> loadActiveSlots() {
        String serialized = preferences.getString(ACTIVE_SLOTS, "1");
        List<Integer> slots = new ArrayList<>();
        if (serialized == null) {
            return slots;
        }

        for (String value : serialized.split(",")) {
            try {
                slots.add(Integer.parseInt(value.trim()));
            } catch (NumberFormatException ignored) {
                // Corrupt entries are ignored and normalized by AccountSlotManager.
            }
        }
        return slots;
    }

    public int loadSelectedSlot() {
        return preferences.getInt(SELECTED_SLOT, 1);
    }

    public String loadLastUrl(int slot) {
        String value = preferences.getString(
                LAST_URL_PREFIX + slot,
                HunteraNavigationPolicy.HOME_URL
        );
        return HunteraNavigationPolicy.isEmbeddedUrlAllowed(value)
                ? value
                : HunteraNavigationPolicy.HOME_URL;
    }

    public void saveSlots(Collection<Integer> activeSlots, int selectedSlot) {
        StringBuilder serialized = new StringBuilder();
        for (Integer slot : activeSlots) {
            if (serialized.length() > 0) {
                serialized.append(',');
            }
            serialized.append(slot);
        }

        preferences.edit()
                .putString(ACTIVE_SLOTS, serialized.toString())
                .putInt(SELECTED_SLOT, selectedSlot)
                .apply();
    }

    public void saveLastUrl(int slot, String url) {
        if (!HunteraNavigationPolicy.isEmbeddedUrlAllowed(url)) {
            return;
        }
        preferences.edit().putString(LAST_URL_PREFIX + slot, url).apply();
    }
}

