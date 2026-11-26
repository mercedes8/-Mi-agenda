package expo.modules.agendaalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

object AlarmScheduler {
  const val ACTION_FIRE = "expo.modules.agendaalarm.FIRE"
  const val EXTRA_ID = "agendaAlarmId"
  const val EXTRA_REMINDER = "agendaReminderId"

  private fun firePending(ctx: Context, id: String, flags: Int): PendingIntent? {
    val i = Intent(ctx, AlarmReceiver::class.java)
      .setAction(ACTION_FIRE)
      .setData(Uri.parse("agenda://alarm/" + Uri.encode(id)))
      .putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(ctx, 0, i, flags or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Intent que abre la app en el recordatorio */
  fun openAppPending(ctx: Context, reminderId: Int, alarmId: String): PendingIntent {
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent()
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    launch.putExtra(EXTRA_REMINDER, reminderId)
    launch.putExtra(EXTRA_ID, alarmId)
    launch.data = Uri.parse("agenda://open/" + Uri.encode(alarmId))
    return PendingIntent.getActivity(ctx, alarmId.hashCode(), launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun canExact(ctx: Context): Boolean {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
  }

  fun schedule(ctx: Context, a: AlarmData) {
    AlarmStore.put(ctx, a)
    register(ctx, a)
  }

  private fun register(ctx: Context, a: AlarmData) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = firePending(ctx, a.id, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
    if (canExact(ctx)) {
      // setAlarmClock: suena a la hora exacta aunque la tablet esté en reposo
      am.setAlarmClock(AlarmManager.AlarmClockInfo(a.ts, openAppPending(ctx, a.reminderId, a.id)), pi)
    } else {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, a.ts, pi)
    }
  }

  fun cancel(ctx: Context, id: String) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    firePending(ctx, id, PendingIntent.FLAG_NO_CREATE)?.let {
      am.cancel(it)
      it.cancel()
    }
    AlarmStore.remove(ctx, id)
  }

  fun cancelAll(ctx: Context) {
    AlarmStore.all(ctx).forEach { cancel(ctx, it.id) }
    AlarmStore.clear(ctx)
  }

  /** Después de reiniciar o cambiar la hora: vuelve a registrar las alarmas futuras */
  fun restoreAll(ctx: Context) {
    val now = System.currentTimeMillis()
    AlarmStore.all(ctx).forEach {
      if (it.ts > now - 60_000) register(ctx, it.copy(ts = maxOf(it.ts, now + 2_000))) else AlarmStore.remove(ctx, it.id)
    }
  }
}
