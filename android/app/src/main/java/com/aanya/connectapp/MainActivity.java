package com.aanya.connectapp;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startBackgroundService();
    }

    @Override
    public void onStart() {
        super.onStart();
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void saveConfig(String userId, String connectionId, String partnerName) {
                        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                        prefs.edit()
                                .putString("user_id", userId)
                                .putString("connection_id", connectionId)
                                .putString("partner_name", partnerName)
                                .apply();
                    }
                }, "AndroidNativeConfig");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void startBackgroundService() {
        try {
            Intent intent = new Intent(this, HeartbeatService.class);
            startService(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
