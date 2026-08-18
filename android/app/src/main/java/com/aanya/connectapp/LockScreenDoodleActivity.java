package com.aanya.connectapp;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import java.net.URLEncoder;

public class LockScreenDoodleActivity extends Activity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Allow drawing and interacting directly ABOVE lock screen without entering password or PIN
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        
        Window window = getWindow();
        if (window != null) {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            );
        }

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF170610);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebViewClient(new WebViewClient());
        webView.setBackgroundColor(0xFF170610);

        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // Close button to dismiss lockscreen doodle
        ImageButton closeBtn = new ImageButton(this);
        closeBtn.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
        closeBtn.setBackgroundColor(0x88000000);
        closeBtn.setPadding(24, 24, 24, 24);
        closeBtn.setOnClickListener(v -> finish());

        FrameLayout.LayoutParams btnParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        btnParams.topMargin = 40;
        btnParams.rightMargin = 40;
        btnParams.gravity = android.view.Gravity.TOP | android.view.Gravity.END;
        root.addView(closeBtn, btnParams);

        setContentView(root);

        // Load live web doodle canvas with authenticated context
        try {
            SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
            String userId = prefs.getString("user_id", "");
            String connId = prefs.getString("connection_id", "");
            String partnerName = prefs.getString("partner_name", "Aanya");

            String url = "https://aanya-and-me.pages.dev/?screen=doodle"
                    + "&user_id=" + URLEncoder.encode(userId, "UTF-8")
                    + "&connection_id=" + URLEncoder.encode(connId, "UTF-8")
                    + "&partner_name=" + URLEncoder.encode(partnerName, "UTF-8");
            webView.loadUrl(url);
        } catch (Exception e) {
            webView.loadUrl("https://aanya-and-me.pages.dev/?screen=doodle");
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
