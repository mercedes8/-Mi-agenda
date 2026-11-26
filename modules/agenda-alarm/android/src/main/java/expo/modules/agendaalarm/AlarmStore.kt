package expo.modules.agendaalarm

import android.content.Context
import org.json.JSONObject

/** Alarmas programadas, guardadas para poder reprogramarlas después de reiniciar la tablet */
data class AlarmData(val id: String, val ts: Long, val title: String, val body: String, val reminderId: Int) {
  fun toJson(): String = JSONObject()
    .put("id", id).put("ts", ts).put("title", title).put("body", body).put("reminderId", reminderId)
    .toString()

  companion object {
    fun fromJson(s: String): AlarmData? = try {
      val o = JSONObject(s)
      AlarmData(o.getString("id"), o.getLong("ts"), o.optString("title"), o.optString("body"), o.optInt("reminderId", -1))
    } catch (e: Exception) {
      null
    }
  }
}

object AlarmStore {
  private const val PREFS = "agenda_alarms"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun put(ctx: Context, a: AlarmData) {
    prefs(ctx).edit().putString(a.id, a.toJson()).apply()
  }

  fun get(ctx: Context, id: String): AlarmData? = prefs(ctx).getString(id, null)?.let { AlarmData.fromJson(it) }

  fun remove(ctx: Context, id: String) {
    prefs(ctx).edit().remove(id).apply()
  }

  fun all(ctx: Context): List<AlarmData> =
    prefs(ctx).all.values.mapNotNull { (it as? String)?.let { s -> AlarmData.fromJson(s) } }

  fun clear(ctx: Context) {
    prefs(ctx).edit().clear().apply()
  }
}
