package org.freeanima.app;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

  @PluginMethod
  public void installFromUrl(PluginCall call) {
    String assetUrl = call.getString("url");
    if (assetUrl == null || assetUrl.isEmpty()) {
      call.reject("url required");
      return;
    }
    if (!assetUrl.startsWith("https://") && !assetUrl.startsWith("http://")) {
      call.reject("invalid url");
      return;
    }

    new Thread(
            () -> {
              try {
                File apk = downloadApk(assetUrl);
                getActivity()
                    .runOnUiThread(
                        () -> {
                          try {
                            launchInstaller(apk);
                            JSObject ret = new JSObject();
                            ret.put("ok", true);
                            call.resolve(ret);
                          } catch (Exception e) {
                            call.reject("install failed: " + e.getMessage(), e);
                          }
                        });
              } catch (Exception e) {
                call.reject("download failed: " + e.getMessage(), e);
              }
            })
        .start();
  }

  private File downloadApk(String assetUrl) throws Exception {
    URL url = new URL(assetUrl);
    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    conn.setInstanceFollowRedirects(true);
    conn.setRequestProperty("User-Agent", "freeanima-mobile-updater");
    conn.connect();
    int code = conn.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Exception("HTTP " + code);
    }
    File out = new File(getContext().getCacheDir(), "freeanima-mobile-android.apk");
    try (InputStream in = conn.getInputStream();
        FileOutputStream fos = new FileOutputStream(out)) {
      byte[] buf = new byte[8192];
      int n;
      while ((n = in.read(buf)) > 0) {
        fos.write(buf, 0, n);
      }
    } finally {
      conn.disconnect();
    }
    return out;
  }

  private void launchInstaller(File apk) {
    Uri uri =
        FileProvider.getUriForFile(
            getContext(), getContext().getPackageName() + ".fileprovider", apk);
    Intent intent = new Intent(Intent.ACTION_VIEW);
    intent.setDataAndType(uri, "application/vnd.android.package-archive");
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    getActivity().startActivity(intent);
  }
}
