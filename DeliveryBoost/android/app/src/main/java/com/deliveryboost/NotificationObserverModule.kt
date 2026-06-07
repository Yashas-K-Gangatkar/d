package com.deliveryboost

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationObserverModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "NotificationObserver"
  }

  @ReactMethod
  fun openNotificationAccessSettings() {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
    reactApplicationContext.startActivity(intent)
  }

  @ReactMethod
  fun openApp(packageName: String, promise: Promise) {
    val packageManager = reactApplicationContext.packageManager
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    if (launchIntent != null) {
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(launchIntent)
      promise.resolve(true)
    } else {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun hasNotificationAccess(promise: Promise) {
    val enabledListeners = Settings.Secure.getString(
      reactApplicationContext.contentResolver,
      "enabled_notification_listeners",
    ) ?: ""
    val packageName = reactApplicationContext.packageName
    promise.resolve(enabledListeners.contains(packageName))
  }
}
