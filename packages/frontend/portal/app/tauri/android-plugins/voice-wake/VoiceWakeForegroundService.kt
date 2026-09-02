package com.freeanima.portal.voicewake

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.app.NotificationCompat
import java.util.Locale

/**
 * 前台服务：持续监听唤醒词「小风」（SpeechRecognizer 部分结果匹配）。
 * Porcupine 自定义 .ppn 可在后续通过 [VoiceWakeConfig] 接入。
 */
class VoiceWakeForegroundService : Service() {
  companion object {
    const val ACTION_START = "com.freeanima.portal.voicewake.START"
    const val ACTION_STOP = "com.freeanima.portal.voicewake.STOP"
    const val EXTRA_WAKE_PHRASE = "wake_phrase"
    const val EXTRA_SENSITIVITY = "sensitivity"
    const val CHANNEL_ID = "freeanima.voice_wake"
    const val NOTIFICATION_ID = 41001
    const val DEFAULT_WAKE_PHRASE = "小风"

    @Volatile
    var wakeCallback: ((String) -> Unit)? = null
  }

  private var speechRecognizer: SpeechRecognizer? = null
  private var wakePhrase: String = DEFAULT_WAKE_PHRASE
  private var listening = false
  private val mainHandler = Handler(Looper.getMainLooper())
  private var restartRunnable: Runnable? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopListeningInternal()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_START, null -> {
        wakePhrase = intent?.getStringExtra(EXTRA_WAKE_PHRASE)?.trim().orEmpty()
          .ifEmpty { DEFAULT_WAKE_PHRASE }
        ensureChannel()
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          startForeground(
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
          )
        } else {
          @Suppress("DEPRECATION")
          startForeground(NOTIFICATION_ID, notification)
        }
        startListeningInternal()
        return START_STICKY
      }
      else -> return START_NOT_STICKY
    }
  }

  override fun onDestroy() {
    stopListeningInternal()
    super.onDestroy()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (mgr.getNotificationChannel(CHANNEL_ID) != null) return
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        "语音助手唤醒",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "监听唤醒词「小风」"
        setShowBadge(false)
      }
    mgr.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pending =
      PendingIntent.getActivity(
        this,
        0,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("逸灵风语音助手")
      .setContentText("正在监听唤醒词「$wakePhrase」")
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentIntent(pending)
      .setOngoing(true)
      .setSilent(true)
      .build()
  }

  private fun startListeningInternal() {
    if (listening) return
    if (!SpeechRecognizer.isRecognitionAvailable(this)) return
    listening = true
    scheduleRecognizerRestart(0)
  }

  private fun stopListeningInternal() {
    listening = false
    restartRunnable?.let { mainHandler.removeCallbacks(it) }
    restartRunnable = null
    speechRecognizer?.destroy()
    speechRecognizer = null
  }

  private fun scheduleRecognizerRestart(delayMs: Long) {
    restartRunnable?.let { mainHandler.removeCallbacks(it) }
    val runnable =
      Runnable {
        if (!listening) return@Runnable
        startRecognizerSession()
      }
    restartRunnable = runnable
    mainHandler.postDelayed(runnable, delayMs)
  }

  private fun startRecognizerSession() {
    speechRecognizer?.destroy()
    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
      setRecognitionListener(recognitionListener)
    }
    val intent =
      Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.CHINESE.toLanguageTag())
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
      }
    try {
      speechRecognizer?.startListening(intent)
    } catch (_: Exception) {
      scheduleRecognizerRestart(1500)
    }
  }

  private fun containsWakePhrase(text: String): Boolean {
    val normalized = text.replace("\\s".toRegex(), "")
    if (normalized.isEmpty()) return false
    val phrase = wakePhrase.replace("\\s".toRegex(), "")
    return normalized.contains(phrase)
  }

  private fun onWakeDetected(matched: String) {
    wakeCallback?.invoke(matched)
    scheduleRecognizerRestart(2500)
  }

  private val recognitionListener =
    object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) {}

      override fun onBeginningOfSpeech() {}

      override fun onRmsChanged(rmsdB: Float) {}

      override fun onBufferReceived(buffer: ByteArray?) {}

      override fun onEndOfSpeech() {}

      override fun onError(error: Int) {
        if (!listening) return
        val delay =
          when (error) {
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
            -> 300L
            else -> 800L
          }
        scheduleRecognizerRestart(delay)
      }

      override fun onResults(results: Bundle?) {
        val texts =
          results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        for (text in texts) {
          if (containsWakePhrase(text)) {
            onWakeDetected(text)
            return
          }
        }
        if (listening) scheduleRecognizerRestart(400)
      }

      override fun onPartialResults(partialResults: Bundle?) {
        val texts =
          partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        for (text in texts) {
          if (containsWakePhrase(text)) {
            onWakeDetected(text)
            return
          }
        }
      }

      override fun onEvent(
        eventType: Int,
        params: Bundle?,
      ) {}
    }
}
