package com.freeanima.portal.blob

import android.app.Activity
import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileOutputStream

@InvokeArg
class SaveToDownloadsArgs {
  lateinit var filename: String
  var mimeType: String? = null
  lateinit var contentsBase64: String
}

@TauriPlugin
class BlobSaverPlugin(private val activity: Activity) : Plugin(activity) {
  override fun load(webView: WebView) {
    super.load(webView)
  }

  @Command
  fun saveToDownloads(invoke: Invoke) {
    val args = invoke.parseArgs(SaveToDownloadsArgs::class.java)
    val filename = sanitizeFilename(args.filename)
    val mime = args.mimeType?.trim().orEmpty().ifEmpty { "application/octet-stream" }
    val bytes =
      try {
        Base64.decode(args.contentsBase64, Base64.DEFAULT)
      } catch (e: Exception) {
        invoke.reject("invalid contents")
        return
      }

    try {
      val path =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          saveViaMediaStore(filename, mime, bytes)
        } else {
          saveViaLegacyDownloads(filename, bytes)
        }
      val ret = JSObject()
      ret.put("cancelled", false)
      ret.put("path", path)
      invoke.resolve(ret)
    } catch (e: Exception) {
      invoke.reject("save failed: ${e.message}", e)
    }
  }

  private fun sanitizeFilename(raw: String): String {
    val base = raw.trim().substringAfterLast('/').substringAfterLast('\\')
    val cleaned = base.replace(Regex("[<>:\"|?*\\x00]"), "_").trim()
    return cleaned.ifEmpty { "download" }
  }

  private fun saveViaMediaStore(filename: String, mime: String, bytes: ByteArray): String {
    val values =
      ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, filename)
        put(MediaStore.Downloads.MIME_TYPE, mime)
        put(MediaStore.Downloads.IS_PENDING, 1)
      }
    val resolver = activity.contentResolver
    val uri =
      resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw Exception("无法创建下载项")
    resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: throw Exception("无法写入")
    values.clear()
    values.put(MediaStore.Downloads.IS_PENDING, 0)
    resolver.update(uri, values, null, null)
    return uri.toString()
  }

  private fun saveViaLegacyDownloads(filename: String, bytes: ByteArray): String {
    val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
    if (!dir.exists() && !dir.mkdirs()) {
      throw Exception("无法创建下载目录")
    }
    var dest = File(dir, filename)
    var i = 1
    val stem = dest.nameWithoutExtension
    val ext = dest.extension
    while (dest.exists()) {
      dest = File(dir, if (ext.isEmpty()) "$stem ($i)" else "$stem ($i).$ext")
      i += 1
    }
    FileOutputStream(dest).use { it.write(bytes) }
    return dest.absolutePath
  }
}
