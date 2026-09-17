package com.freeanima.portal.apk

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.webkit.WebView
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

@InvokeArg
class InstallFromUrlArgs {
  lateinit var url: String
}

@TauriPlugin
class ApkInstallerPlugin(private val activity: Activity) : Plugin(activity) {
  override fun load(webView: WebView) {
    super.load(webView)
  }

  @Command
  fun installFromUrl(invoke: Invoke) {
    val args = invoke.parseArgs(InstallFromUrlArgs::class.java)
    val assetUrl = args.url
    if (assetUrl.isBlank()) {
      invoke.reject("url required")
      return
    }
    if (!assetUrl.startsWith("https://") && !assetUrl.startsWith("http://")) {
      invoke.reject("invalid url")
      return
    }

    Thread {
      try {
        val apk = downloadApk(assetUrl)
        notifyProgress(apk.length(), apk.length(), "installing")
        activity.runOnUiThread {
          try {
            launchInstaller(apk)
            val ret = JSObject()
            ret.put("ok", true)
            invoke.resolve(ret)
          } catch (e: Exception) {
            invoke.reject("install failed: ${e.message}", e)
          }
        }
      } catch (e: Exception) {
        invoke.reject("download failed: ${e.message}", e)
      }
    }.start()
  }

  private fun notifyProgress(received: Long, total: Long, phase: String) {
    val progress = JSObject()
    progress.put("received", received)
    if (total > 0) {
      progress.put("total", total)
    }
    progress.put("phase", phase)
    // Channel → WebView 须在主线程；后台下载线程直接 trigger 时进度事件会静默丢失
    activity.runOnUiThread { trigger("downloadProgress", progress) }
  }

  private fun downloadApk(assetUrl: String): File {
    val url = URL(assetUrl)
    val conn = url.openConnection() as HttpURLConnection
    conn.instanceFollowRedirects = true
    conn.setRequestProperty("User-Agent", "freeanima-mobile-updater")
    conn.connect()
    val code = conn.responseCode
    if (code < 200 || code >= 300) {
      throw Exception("HTTP $code")
    }
    val total = conn.contentLengthLong
    val out = File(activity.cacheDir, "freeanima-mobile-android.apk")
    var received = 0L
    var lastNotifyAt = 0L
    notifyProgress(0L, total, "downloading")
    try {
      conn.inputStream.use { input ->
        FileOutputStream(out).use { fos ->
          val buf = ByteArray(8192)
          while (true) {
            val n = input.read(buf)
            if (n <= 0) break
            fos.write(buf, 0, n)
            received += n
            val now = System.currentTimeMillis()
            if (now - lastNotifyAt >= 100 || (total > 0 && received >= total)) {
              lastNotifyAt = now
              notifyProgress(received, total, "downloading")
            }
          }
        }
      }
    } finally {
      conn.disconnect()
    }
    notifyProgress(received, if (total > 0) total else received, "downloading")
    return out
  }

  private fun launchInstaller(apk: File) {
    val uri: Uri =
      FileProvider.getUriForFile(
        activity,
        activity.packageName + ".fileprovider",
        apk,
      )
    val intent = Intent(Intent.ACTION_VIEW)
    intent.setDataAndType(uri, "application/vnd.android.package-archive")
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // REQUEST_INSTALL_PACKAGES 在 Manifest 中声明；系统会引导用户授权
    }
    activity.startActivity(intent)
  }
}
