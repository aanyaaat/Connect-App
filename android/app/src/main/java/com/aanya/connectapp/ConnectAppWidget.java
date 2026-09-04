package com.aanya.connectapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

public class ConnectAppWidget extends AppWidgetProvider {
    public static final String ACTION_SEND_LOVE = "com.aanya.connectapp.ACTION_SEND_LOVE";
    public static final String ACTION_OPEN_DOODLE = "com.aanya.connectapp.ACTION_OPEN_DOODLE";
    public static final String ACTION_OPEN_TOUCH = "com.aanya.connectapp.ACTION_OPEN_TOUCH";
    public static final String ACTION_REACHED_HOME = "com.aanya.connectapp.ACTION_REACHED_HOME";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences("aanya_prefs", Context.MODE_PRIVATE);
        String partnerName = prefs.getString("partner_name", "Partner");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_connect_layout);
        views.setTextViewText(R.id.widget_partner_name, partnerName + " & Me ❤️");
        views.setTextViewText(R.id.widget_status_text, "Connected · 24/7 Live");

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Open app when tapping the container
        Intent openAppIntent = new Intent(context, MainActivity.class);
        PendingIntent openAppPi = PendingIntent.getActivity(context, 0, openAppIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_container, openAppPi);

        // 💖 Love button intent
        Intent loveIntent = new Intent(context, MainActivity.class);
        loveIntent.setAction(ACTION_SEND_LOVE);
        PendingIntent lovePi = PendingIntent.getActivity(context, 1, loveIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_btn_love, lovePi);

        // 🎨 Doodle button intent
        Intent doodleIntent = new Intent(context, MainActivity.class);
        doodleIntent.setAction(ACTION_OPEN_DOODLE);
        PendingIntent doodlePi = PendingIntent.getActivity(context, 2, doodleIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_btn_doodle, doodlePi);

        // 💓 Touch button intent
        Intent touchIntent = new Intent(context, MainActivity.class);
        touchIntent.setAction(ACTION_OPEN_TOUCH);
        PendingIntent touchPi = PendingIntent.getActivity(context, 3, touchIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_btn_touch, touchPi);

        // 🏠 Home button intent
        Intent homeIntent = new Intent(context, MainActivity.class);
        homeIntent.setAction(ACTION_REACHED_HOME);
        PendingIntent homePi = PendingIntent.getActivity(context, 4, homeIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_btn_home, homePi);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
