package com.aanya.connectapp;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;

/**
 * Official showWhenLocked Lock-Screen Activity for Aanya & Me Live Realtime Doodle.
 * Appears above the keyguard when triggered by user action without bypassing or compromising device security.
 * Loads local bundled web assets and securely communicates via JavaScript Interface.
 */
public class LockScreenDoodleActivity extends Activity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Official Android API for rendering above keyguard
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            Window window = getWindow();
            if (window != null) {
                window.addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                );
            }
        }

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0F0712);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Secure Native Bridge for local authenticated doodle session
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String getUserId() {
                SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                return prefs.getString("user_id", "");
            }

            @JavascriptInterface
            public String getConnectionId() {
                SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                return prefs.getString("connection_id", "");
            }

            @JavascriptInterface
            public String getPartnerName() {
                SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                return prefs.getString("partner_name", "Aanya");
            }

            @JavascriptInterface
            public void closeDoodle() {
                runOnUiThread(() -> finish());
            }
        }, "AndroidDoodleBridge");

        webView.setWebViewClient(new WebViewClient());
        webView.setBackgroundColor(0xFF0F0712);

        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // Close button to dismiss lockscreen doodle cleanly
        ImageButton closeBtn = new ImageButton(this);
        closeBtn.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
        closeBtn.setBackgroundColor(Color.parseColor("#44000000"));
        closeBtn.setPadding(28, 28, 28, 28);
        closeBtn.setOnClickListener(v -> finish());

        FrameLayout.LayoutParams btnParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        btnParams.topMargin = 48;
        btnParams.rightMargin = 40;
        btnParams.gravity = Gravity.TOP | Gravity.END;
        root.addView(closeBtn, btnParams);

        setContentView(root);

        // Load local bundled web application at doodle route
        webView.loadUrl("file:///android_asset/public/index.html?screen=doodle");
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
