package com.deliveryboost

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class NotificationListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val notification = sbn.notification
    val extras = notification.extras
    val title = extras.getString("android.title") ?: ""
    val body = extras.getCharSequence("android.text")?.toString() ?: ""
    val payload = Arguments.createMap().apply {
      putString("id", sbn.key.toString())
      putString("sourceApp", sbn.packageName)
      putString("title", title)
      putString("body", body)
      putDouble("timestamp", sbn.postTime.toDouble())
    }
    emitNotification(payload)
  }

  private fun emitNotification(payload: com.facebook.react.bridge.WritableMap) {
    val application = application as? ReactApplication ?: return
    val reactContext = application.reactNativeHost.reactInstanceManager.currentReactContext
    reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      ?.emit("DeliveryBoostNotification", payload)
  }
}
