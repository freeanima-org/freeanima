package com.freeanima.portal.voicewake

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class VoiceWakeStartArgs {
  var wakePhrase: String? = null
  var sensitivity: Double? = null
}

@TauriPlugin
class VoiceWakePlugin(private val activity: Activity) : Plugin(activity) {
  companion object {
    private const val PERMISSION_REQUEST_CODE = 9410
    private var pendingPermissionInvoke: Invoke? = null
  }

  override fun load(webView: WebView) {
    super.load(webView)
    VoiceWakeForegroundService.wakeCallback = { matched ->
      activity.runOnUiThread {
        val payload = JSObject()
        payload.put("phrase", matched)
        trigger("voiceWakeDetected", payload)
      }
    }
  }

  @Command
  fun readVoiceWakePermission(invoke: Invoke) {
    val granted = hasRecordAudioPermission()
    val ret = JSObject()
    ret.put("state", if (granted) "granted" else "denied")
    invoke.resolve(ret)
  }

  @Command
  fun requestVoiceWakePermission(invoke: Invoke) {
    if (hasRecordAudioPermission()) {
      val ret = JSObject()
      ret.put("state", "granted")
      invoke.resolve(ret)
      return
    }
    pendingPermissionInvoke = invoke
    ActivityCompat.requestPermissions(
      activity,
      arrayOf(Manifest.permission.RECORD_AUDIO),
      PERMISSION_REQUEST_CODE,
    )
  }

  @Command
  fun startVoiceWake(invoke: Invoke) {
    if (!hasRecordAudioPermission()) {
      invoke.reject("RECORD_AUDIO not granted")
      return
    }
    val args = invoke.parseArgs(VoiceWakeStartArgs::class.java)
    val intent =
      Intent(activity, VoiceWakeForegroundService::class.java).apply {
        action = VoiceWakeForegroundService.ACTION_START
        val phrase = args.wakePhrase?.trim().orEmpty()
        if (phrase.isNotEmpty()) {
          putExtra(VoiceWakeForegroundService.EXTRA_WAKE_PHRASE, phrase)
        }
        args.sensitivity?.let { putExtra(VoiceWakeForegroundService.EXTRA_SENSITIVITY, it) }
      }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      activity.startForegroundService(intent)
    } else {
      @Suppress("DEPRECATION")
      activity.startService(intent)
    }
    val ret = JSObject()
    ret.put("ok", true)
    invoke.resolve(ret)
  }

  @Command
  fun stopVoiceWake(invoke: Invoke) {
    val intent =
      Intent(activity, VoiceWakeForegroundService::class.java).apply {
        action = VoiceWakeForegroundService.ACTION_STOP
      }
    activity.startService(intent)
    val ret = JSObject()
    ret.put("ok", true)
    invoke.resolve(ret)
  }

  @Command
  fun startSpeechRecognition(invoke: Invoke) {
    if (!hasRecordAudioPermission()) {
      invoke.reject("RECORD_AUDIO not granted")
      return
    }
    activity.runOnUiThread {
      SpeechRecognitionSession.start(activity) { result ->
        val payload = JSObject()
        when (result) {
          is SpeechRecognitionSession.Result.Success -> {
            payload.put("ok", true)
            payload.put("text", result.text)
            payload.put("confidence", result.confidence)
          }
          is SpeechRecognitionSession.Result.Error -> {
            payload.put("ok", false)
            payload.put("error", result.message)
          }
          is SpeechRecognitionSession.Result.Cancelled -> {
            payload.put("ok", false)
            payload.put("error", "cancelled")
          }
        }
        trigger("speechRecognitionResult", payload)
      }
      val ret = JSObject()
      ret.put("ok", true)
      invoke.resolve(ret)
    }
  }

  @Command
  fun stopSpeechRecognition(invoke: Invoke) {
    SpeechRecognitionSession.stop()
    val ret = JSObject()
    ret.put("ok", true)
    invoke.resolve(ret)
  }

  private fun hasRecordAudioPermission(): Boolean =
    ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED

  fun onRequestPermissionsResult(
    requestCode: Int,
    grantResults: IntArray,
  ) {
    if (requestCode != PERMISSION_REQUEST_CODE) return
    val invoke = pendingPermissionInvoke ?: return
    pendingPermissionInvoke = null
    val granted =
      grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
    val ret = JSObject()
    ret.put("state", if (granted) "granted" else "denied")
    invoke.resolve(ret)
  }
}
