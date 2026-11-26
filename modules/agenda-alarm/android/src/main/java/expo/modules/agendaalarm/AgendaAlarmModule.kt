package expo.modules.agendaalarm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AgendaAlarmModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw CodedException("Sin contexto de Android")

  private fun reminderFrom(intent: Intent?): Int {
    val rid = intent?.getIntExtra(AlarmScheduler.EXTRA_REMINDER, -1) ?: -1
    if (rid != -1) intent?.removeExtra(AlarmScheduler.EXTRA_REMINDER)
    return rid
  }

  override fun definition() = ModuleDefinition {
    Name("AgendaAlarm")
    Events("onOpenReminder")

    Function("schedule") { id: String, ts: Double, title: String, body: String, reminderId: Int ->
      AlarmScheduler.schedule(ctx, AlarmData(id, ts.toLong(), title, body, reminderId))
    }

    Function("cancel") { id: String ->
      AlarmScheduler.cancel(ctx, id)
    }

    Function("cancelAll") {
      AlarmScheduler.cancelAll(ctx)
    }

    Function("scheduledIds") {
      AlarmStore.all(ctx).map { it.id }
    }

    Function("stopRinging") {
      AlarmService.stop(ctx)
    }

    Function("canScheduleExact") {
      AlarmScheduler.canExact(ctx)
    }

    Function("canUseFullScreen") {
      if (Build.VERSION.SDK_INT >= 34) {
        (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).canUseFullScreenIntent()
      } else true
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val i = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx.packageName))
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
      }
    }

    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        val i = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx.packageName))
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
      }
    }

    /** Si la app se abrió tocando una alarma, devuelve el id del recordatorio (una sola vez) */
    Function("getLaunchReminder") {
      reminderFrom(appContext.currentActivity?.intent)
    }

    OnNewIntent { intent ->
      val rid = reminderFrom(intent)
      if (rid != -1) sendEvent("onOpenReminder", mapOf("reminderId" to rid))
    }
  }
}
