package br.com.hunterafarm.navigation;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class HunteraNavigationPolicyTest {
    @Test
    public void allowsHunteraHttpsPagesAndSubdomains() {
        assertTrue(HunteraNavigationPolicy.isEmbeddedUrlAllowed("https://huntera.com.br/game"));
        assertTrue(HunteraNavigationPolicy.isEmbeddedUrlAllowed("https://www.huntera.com.br/login"));
        assertTrue(HunteraNavigationPolicy.isEmbeddedUrlAllowed(HunteraNavigationPolicy.HOME_URL));
    }

    @Test
    public void rejectsLookalikesInsecureSchemesAndInvalidUrls() {
        assertFalse(HunteraNavigationPolicy.isEmbeddedUrlAllowed("http://huntera.com.br/game"));
        assertFalse(HunteraNavigationPolicy.isEmbeddedUrlAllowed("https://huntera.com.br.example.com/game"));
        assertFalse(HunteraNavigationPolicy.isEmbeddedUrlAllowed("https://evil-huntera.com.br/game"));
        assertFalse(HunteraNavigationPolicy.isEmbeddedUrlAllowed("javascript:alert(1)"));
        assertFalse(HunteraNavigationPolicy.isEmbeddedUrlAllowed("not a url"));
        assertFalse(HunteraNavigationPolicy.isEmbeddedUrlAllowed(null));
    }
}

