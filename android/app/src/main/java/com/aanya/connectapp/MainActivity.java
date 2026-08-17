package com.aanya.connectapp;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                webView.resumeTimers();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Crucial: keep WebView timers running so WebSockets & background handlers stay active
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.resumeTimers();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.resumeTimers();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
