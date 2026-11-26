package expo.modules.agendaalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    val a = AlarmStore.get(context, id) ?: return
    AlarmStore.remove(context, id)
    val svc = Intent(context, AlarmService::class.java)
      .setAction(AlarmService.ACTION_RING)
      .putExtra("data", a.toJson())
    try {
      ContextCompat.startForegroundService(context, svc)
    } catch (e: Exception) {
      // Si Android no deja iniciar el servicio, al menos mostramos un aviso con sonido de alarma
      fallbackNotify(context, a)
    }
  }

  private fun fallbackNotify(ctx: Context, a: AlarmData) {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = "agenda_aviso_v1"
    val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(channel) == null) {
      val ch = NotificationChannel(channel, "Avisos de recordatorios", NotificationManager.IMPORTANCE_HIGH)
      ch.setSound(sound, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
      nm.createNotificationChannel(ch)
    }
    val n = NotificationCompat.Builder(ctx, channel)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(a.title)
      .setContentText(a.body)
      .setSound(sound)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setAutoCancel(true)
      .setContentIntent(AlarmScheduler.openAppPending(ctx, a.reminderId, a.id))
      .build()
    nm.notify(a.id.hashCode(), n)
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.restoreAll(context)
  }
}
