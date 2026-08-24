package br.com.hunterafarm.accounts;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.TreeSet;

/**
 * Pure Java account-slot state. WebView lifecycle stays in the Activity so this
 * class can be unit tested without an Android runtime.
 */
public final class AccountSlotManager {
    public static final int MAX_PROFILE_SLOTS = 4;
    public static final int NO_SLOT_AVAILABLE = -1;

    private final int activeAccountLimit;
    private final TreeSet<Integer> activeSlots = new TreeSet<>();
    private int selectedSlot;

    public AccountSlotManager(
            int activeAccountLimit,
            Collection<Integer> restoredSlots,
            int preferredSlot
    ) {
        if (activeAccountLimit < 1 || activeAccountLimit > MAX_PROFILE_SLOTS) {
            throw new IllegalArgumentException("activeAccountLimit must be between 1 and 4");
        }

        this.activeAccountLimit = activeAccountLimit;

        // A device without MULTI_PROFILE must never restore a second session in
        // the default profile, otherwise two logins could be mixed together.
        if (activeAccountLimit == 1) {
            activeSlots.add(1);
        } else if (restoredSlots != null) {
            TreeSet<Integer> normalizedSlots = new TreeSet<>();
            for (Integer slot : restoredSlots) {
                if (slot != null && slot >= 1 && slot <= MAX_PROFILE_SLOTS) {
                    normalizedSlots.add(slot);
                }
            }
            for (Integer slot : normalizedSlots) {
                if (activeSlots.size() < activeAccountLimit) {
                    activeSlots.add(slot);
                }
            }
        }

        if (activeSlots.isEmpty()) {
            activeSlots.add(1);
        }

        selectedSlot = activeSlots.contains(preferredSlot)
                ? preferredSlot
                : activeSlots.first();
    }

    public List<Integer> getActiveSlots() {
        return Collections.unmodifiableList(new ArrayList<>(activeSlots));
    }

    public int getSelectedSlot() {
        return selectedSlot;
    }

    public int getActiveAccountLimit() {
        return activeAccountLimit;
    }

    public boolean canAdd() {
        return activeSlots.size() < activeAccountLimit;
    }

    public boolean canRemove() {
        return activeSlots.size() > 1;
    }

    /** Adds and selects the lowest free persistent profile slot. */
    public int addAccount() {
        if (!canAdd()) {
            return NO_SLOT_AVAILABLE;
        }

        for (int slot = 1; slot <= MAX_PROFILE_SLOTS; slot++) {
            if (!activeSlots.contains(slot)) {
                activeSlots.add(slot);
                selectedSlot = slot;
                return slot;
            }
        }

        return NO_SLOT_AVAILABLE;
    }

    public boolean select(int slot) {
        if (!activeSlots.contains(slot)) {
            return false;
        }
        selectedSlot = slot;
        return true;
    }

    /**
     * Removes a visual slot but intentionally leaves its WebKit Profile on disk,
     * so its login is restored if the slot is added again.
     */
    public boolean remove(int slot) {
        if (!canRemove() || !activeSlots.remove(slot)) {
            return false;
        }

        if (selectedSlot == slot) {
            Integer next = activeSlots.higher(slot);
            selectedSlot = next != null ? next : activeSlots.last();
        }
        return true;
    }
}
