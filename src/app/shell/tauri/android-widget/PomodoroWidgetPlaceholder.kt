/**
 * 番茄钟主屏小组件 MVP（Android Glance 占位）。
 *
 * 数据流：
 * 1. shell-ui / pomodoro 调用 `invoke("set_pomodoro_widget_state", …)`
 * 2. Rust MobileState 持有快照；后续写入 SharedPreferences 键
 *    `freeanima.pomodoro.widget`（与 shell-sdk pomodoro-active 语义对齐）
 * 3. 本 Receiver + GlanceAppWidget 读键并 `updateAll`
 *
 * `tauri android init` 生成工程后，将本文件并入 `app/src/main/java/...` 并在
 * AndroidManifest 注册 `<receiver android:name=".widget.PomodoroWidgetReceiver" …>`。
 */
package org.freeanima.app.widget

/*
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.text.Text

class PomodoroGlanceWidget : GlanceAppWidget() {
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val prefs = context.getSharedPreferences("freeanima_shell", Context.MODE_PRIVATE)
    val phase = prefs.getString("pomodoro.phase", "idle") ?: "idle"
    val remaining = prefs.getLong("pomodoro.remaining_sec", 0L)
    val title = prefs.getString("pomodoro.task_title", null)
    provideContent {
      WidgetContent(phase, remaining, title)
    }
  }
}

@Composable
private fun WidgetContent(phase: String, remaining: Long, title: String?) {
  Column(
    modifier = GlanceModifier.fillMaxSize(),
    verticalAlignment = Alignment.CenterVertically,
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text(text = title ?: "FreeAnima")
    Text(text = if (phase == "idle") "空闲" else "$phase · ${remaining}s")
  }
}

class PomodoroWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = PomodoroGlanceWidget()
}
*/

/** 占位：Tauri Android gen 完成后取消注释并接入 store 同步。 */
object PomodoroWidgetPlaceholder {
  const val PREFS_NAME = "freeanima_shell"
  const val KEY_PHASE = "pomodoro.phase"
  const val KEY_REMAINING = "pomodoro.remaining_sec"
  const val KEY_TITLE = "pomodoro.task_title"
}
