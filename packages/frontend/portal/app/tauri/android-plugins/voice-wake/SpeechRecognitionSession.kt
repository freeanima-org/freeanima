package com.freeanima.portal.voicewake

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

/** 唤醒后单次指令收音（与唤醒监听分离）。 */
object SpeechRecognitionSession {
  sealed class Result {
    data class Success(val text: String, val confidence: Double) : Result()

    data class Error(val message: String) : Result()

    object Cancelled : Result()
  }

  private var speechRecognizer: SpeechRecognizer? = null
  private var callback: ((Result) -> Unit)? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var timeoutRunnable: Runnable? = null

  fun start(
    context: Context,
    onResult: (Result) -> Unit,
  ) {
    stop()
    callback = onResult
    if (!SpeechRecognizer.isRecognitionAvailable(context)) {
      deliver(Result.Error("SpeechRecognizer unavailable"))
      return
    }
    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context.applicationContext)
    speechRecognizer?.setRecognitionListener(recognitionListener)
    val intent =
      Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.CHINESE.toLanguageTag())
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1200)
        putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1200)
      }
    try {
      speechRecognizer?.startListening(intent)
      timeoutRunnable =
        Runnable {
          stopInternal()
          deliver(Result.Error("timeout"))
        }
      mainHandler.postDelayed(timeoutRunnable!!, 12_000)
    } catch (e: Exception) {
      deliver(Result.Error(e.message ?: "start failed"))
    }
  }

  fun stop() {
    stopInternal()
    deliver(Result.Cancelled)
  }

  private fun stopInternal() {
    timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    timeoutRunnable = null
    speechRecognizer?.destroy()
    speechRecognizer = null
  }

  private fun deliver(result: Result) {
    val cb = callback
    callback = null
    cb?.invoke(result)
  }

  private val recognitionListener =
    object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) {}

      override fun onBeginningOfSpeech() {}

      override fun onRmsChanged(rmsdB: Float) {}

      override fun onBufferReceived(buffer: ByteArray?) {}

      override fun onEndOfSpeech() {}

      override fun onError(error: Int) {
        stopInternal()
        deliver(Result.Error("error_$error"))
      }

      override fun onResults(results: Bundle?) {
        stopInternal()
        val texts =
          results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        val scores = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)
        val text = texts.firstOrNull()?.trim().orEmpty()
        if (text.isEmpty()) {
          deliver(Result.Error("empty"))
          return
        }
        val confidence =
          if (scores != null && scores.isNotEmpty()) scores[0].toDouble() else 0.85
        deliver(Result.Success(text, confidence))
      }

      override fun onPartialResults(partialResults: Bundle?) {}

      override fun onEvent(
        eventType: Int,
        params: Bundle?,
      ) {}
    }
}
