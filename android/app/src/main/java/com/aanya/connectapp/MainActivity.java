package com.aanya.connectapp;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startBackgroundService();
    }

    @Override
    public void onResume() {
        super.onResume();
        HeartbeatService.isAppInForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        HeartbeatService.isAppInForeground = false;
    }

    @Override
    public void onStart() {
        super.onStart();
        HeartbeatService.isAppInForeground = true;
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

                    @JavascriptInterface
                    public void savePowerMessage(String text, String emoji) {
                        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                        prefs.edit()
                                .putString("power_message_text", text)
                                .putString("power_message_emoji", emoji)
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
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(this, intent);
            } else {
                startService(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
