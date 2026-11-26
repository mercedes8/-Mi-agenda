package expo.modules.agendaalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * Hace sonar el recordatorio como un despertador: usa el volumen de ALARMA (suena aunque la
 * tablet esté en silencio), se repite hasta que lo detengas (máximo 1 minuto) y muestra una
 * notificación a pantalla completa con Detener / Posponer.
 */
class AlarmService : Service() {
  companion object {
    const val ACTION_RING = "expo.modules.agendaalarm.RING"
    const val ACTION_STOP = "expo.modules.agendaalarm.STOP"
    const val ACTION_SNOOZE = "expo.modules.agendaalarm.SNOOZE"
    const val CHANNEL = "agenda_alarma_v1"
    const val RING_ID = 4711
    private const val MAX_MS = 60_000L

    fun stop(ctx: Context) {
      ctx.startService(Intent(ctx, AlarmService::class.java).setAction(ACTION_STOP))
    }
  }

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wake: PowerManager.WakeLock? = null
  private var current: AlarmData? = null
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable { finishRinging(true) }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_RING -> {
        val a = intent.getStringExtra("data")?.let { AlarmData.fromJson(it) }
        if (a == null) {
          stopSelf()
          return START_NOT_STICKY
        }
        ring(a)
      }
      ACTION_SNOOZE -> {
        current?.let {
          AlarmScheduler.schedule(this, it.copy(id = it.id + "_pospuesta", ts = System.currentTimeMillis() + 10 * 60_000L))
        }
        finishRinging(false)
      }
      else -> finishRinging(false)
    }
    return START_NOT_STICKY
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL) == null) {
      val ch = NotificationChannel(CHANNEL, "Alarmas de recordatorios", NotificationManager.IMPORTANCE_HIGH)
      ch.description = "Recordatorios que suenan como despertador"
      ch.setSound(null, null) // el sonido lo reproduce el servicio
      ch.enableVibration(false)
      ch.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      nm.createNotificationChannel(ch)
    }
  }

  private fun servicePending(action: String, code: Int): PendingIntent =
    PendingIntent.getService(this, code, Intent(this, AlarmService::class.java).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  private fun ring(a: AlarmData) {
    stopSound()
    current = a
    ensureChannel()
    val open = AlarmScheduler.openAppPending(this, a.reminderId, a.id)
    val n = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(a.title)
      .setContentText(a.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(a.body))
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(true)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .setDeleteIntent(servicePending(ACTION_STOP, 2))
      .addAction(0, "Detener", servicePending(ACTION_STOP, 3))
      .addAction(0, "Posponer 10 min", servicePending(ACTION_SNOOZE, 4))
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(RING_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(RING_ID, n)
    }

    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MiAgenda:alarma").apply { acquire(MAX_MS + 5_000) }

    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val resId = resources.getIdentifier("campanita", "raw", packageName)
    val uri: Uri = if (resId != 0) Uri.parse("android.resource://$packageName/$resId")
      else RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
    try {
      player = MediaPlayer().apply {
        setAudioAttributes(attrs)
        setDataSource(this@AlarmService, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (e: Exception) {
      player = null
    }

    vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 500), 0), attrs)
    } else {
      @Suppress("DEPRECATION")
      vibrator?.vibrate(longArrayOf(0, 500, 500), 0)
    }

    handler.removeCallbacks(timeout)
    handler.postDelayed(timeout, MAX_MS)
  }

  private fun stopSound() {
    handler.removeCallbacks(timeout)
    try {
      player?.stop()
    } catch (_: Exception) {
    }
    player?.release()
    player = null
    vibrator?.cancel()
    vibrator = null
    if (wake?.isHeld == true) wake?.release()
    wake = null
  }

  /** Corta el sonido. Si se cortó solo (nadie lo atendió), deja una notificación para verlo después. */
  private fun finishRinging(missed: Boolean) {
    stopSound()
    val a = current
    current = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    if (missed && a != null) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val n = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
        .setContentTitle(a.title)
        .setContentText(a.body)
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .setAutoCancel(true)
        .setContentIntent(AlarmScheduler.openAppPending(this, a.reminderId, a.id))
        .build()
      nm.notify(a.id.hashCode(), n)
    }
    stopSelf()
  }

  override fun onDestroy() {
    stopSound()
    super.onDestroy()
  }
}
