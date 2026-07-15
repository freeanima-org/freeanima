package org.freeanima.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import org.freeanima.app.BuildConfig;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(ApkInstallerPlugin.class);
    super.onCreate(savedInstanceState);
    if (BuildConfig.DEBUG) {
      WebView.setWebContentsDebuggingEnabled(true);
    }
  }
}
