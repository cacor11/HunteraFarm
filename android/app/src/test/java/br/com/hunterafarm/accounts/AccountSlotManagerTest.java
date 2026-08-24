package br.com.hunterafarm.accounts;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;

public class AccountSlotManagerTest {
    @Test
    public void startsWithOneAccountWhenNothingWasPersisted() {
        AccountSlotManager manager = new AccountSlotManager(4, Collections.emptyList(), 4);

        assertEquals(Collections.singletonList(1), manager.getActiveSlots());
        assertEquals(1, manager.getSelectedSlot());
    }

    @Test
    public void addsLowestAvailableSlotsAndStopsAtFour() {
        AccountSlotManager manager = new AccountSlotManager(4, Collections.singletonList(1), 1);

        assertEquals(2, manager.addAccount());
        assertEquals(3, manager.addAccount());
        assertEquals(4, manager.addAccount());
        assertEquals(AccountSlotManager.NO_SLOT_AVAILABLE, manager.addAccount());
        assertEquals(Arrays.asList(1, 2, 3, 4), manager.getActiveSlots());
        assertEquals(4, manager.getSelectedSlot());
    }

    @Test
    public void removingSelectedSlotSelectsNextThenPrevious() {
        AccountSlotManager manager = new AccountSlotManager(4, Arrays.asList(1, 2, 3), 2);

        assertTrue(manager.remove(2));
        assertEquals(3, manager.getSelectedSlot());
        assertTrue(manager.remove(3));
        assertEquals(1, manager.getSelectedSlot());
    }

    @Test
    public void neverRemovesLastAccount() {
        AccountSlotManager manager = new AccountSlotManager(4, Collections.singletonList(2), 2);

        assertFalse(manager.remove(2));
        assertEquals(Collections.singletonList(2), manager.getActiveSlots());
    }

    @Test
    public void fallbackModeForcesExactlyAccountOne() {
        AccountSlotManager manager = new AccountSlotManager(1, Arrays.asList(2, 3, 4), 3);

        assertEquals(Collections.singletonList(1), manager.getActiveSlots());
        assertEquals(1, manager.getSelectedSlot());
        assertFalse(manager.canAdd());
    }
}

