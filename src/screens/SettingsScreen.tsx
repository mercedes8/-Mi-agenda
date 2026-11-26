import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppState';
import { Btn, Sheet, Title } from '../components/ui';
import { exportAll, importAll, useSetting } from '../db';
import { ymd } from '../dates';
import { exactAlarmStatus, requestExactAlarm, rescheduleAll, setupNotifications, testNotification } from '../notifications';
import { C } from '../theme';

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {desc ? <Text style={s.rowDesc}>{desc}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function SettingsScreen() {
  const { setCoverVisible } = useApp();
  const [stylusOnly, setStylusOnly] = useSetting('stylusOnly', '0');
  const [owner, setOwner] = useSetting('ownerName', '');
  const [contact, setContact] = useSetting('ownerContact', '');
  const [showCover, setShowCover] = useSetting('showCover', '1');
  const [exact, setExact] = useSetting('exactAlarms', '1');
  const [exactOk, setExactOk] = useState(true);
  useEffect(() => {
    exactAlarmStatus().then(setExactOk);
  }, []);

  const doExport = async () => {
    try {
      const f = new File(Paths.cache, `mi-agenda-backup-${ymd(new Date())}.json`);
      if (f.exists) f.delete();
      f.create();
      f.writeSync(exportAll());
      await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Guardar copia de seguridad' });
    } catch (e) {
      Alert.alert('No se pudo exportar', String(e));
    }
  };

  const doImport = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    Alert.alert('Restaurar copia', 'Esto REEMPLAZA todo el contenido actual de la agenda por el del archivo. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar',
        style: 'destructive',
        onPress: async () => {
          try {
            const text = await new File(res.assets[0].uri).text();
            importAll(text);
            await rescheduleAll();
            Alert.alert('Listo', 'La agenda se restauró y los recordatorios se volvieron a programar.');
          } catch (e) {
            Alert.alert('No se pudo restaurar', String(e));
          }
        },
      },
    ]);
  };

  return (
    <View style={s.wrap}>
      <Sheet style={{ flex: 1 }}>
        <ScrollView>
          <Title style={{ fontSize: 20 }}>⚙️ Ajustes</Title>

          <Text style={s.group}>Mi agenda</Text>
          <Row title="Nombre de quien la usa" desc="Aparece en la tapa y al pie de cada hoja.">
            <TextInput style={s.input} value={owner} onChangeText={setOwner} placeholder="Tu nombre" placeholderTextColor="#B8AFA2" />
          </Row>
          <Row title="Contacto si se pierde" desc="Opcional. Se muestra en la tapa.">
            <TextInput style={s.input} value={contact} onChangeText={setContact} placeholder="Teléfono o email" placeholderTextColor="#B8AFA2" />
          </Row>
          <Row title="Mostrar la tapa al abrir la app">
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Switch value={showCover === '1'} onValueChange={(v) => setShowCover(v ? '1' : '0')} trackColor={{ true: C.accent }} />
              <Btn small outline label="📕 Ver la tapa" onPress={() => setCoverVisible(true)} />
            </View>
          </Row>

          <Text style={s.group}>Escritura a mano</Text>
          <Row
            title="Solo lápiz óptico"
            desc="Si lo activás, en modo lápiz se ignoran los dedos (evita marcas al apoyar la mano). Funciona con S Pen y lápices activos."
          >
            <Switch value={stylusOnly === '1'} onValueChange={(v) => setStylusOnly(v ? '1' : '0')} trackColor={{ true: C.accent }} />
          </Row>

          <Text style={s.group}>Recordatorios y sonido</Text>
          <Row title="Probar sonido" desc="Lanza una notificación de prueba en 3 segundos.">
            <Btn small label="🔔 Probar" onPress={() => testNotification()} />
          </Row>
          <Row title="Permiso de notificaciones" desc="Necesario para que suenen los recordatorios.">
            <Btn small outline label="Pedir permiso" onPress={() => setupNotifications()} />
          </Row>
          <Row
            title="Alarmas exactas"
            desc={
              exactOk
                ? 'Los recordatorios suenan a la hora exacta aunque la tablet esté en reposo (muestra un ícono de alarma en la barra).'
                : '⚠️ Android no dio permiso de alarmas exactas. Tocá "Habilitar".'
            }
          >
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Switch
                value={exact === '1'}
                onValueChange={async (v) => {
                  setExact(v ? '1' : '0');
                  await rescheduleAll();
                }}
                trackColor={{ true: C.accent }}
              />
              {!exactOk && <Btn small label="Habilitar" onPress={async () => setExactOk(await requestExactAlarm())} />}
            </View>
          </Row>
          <Row
            title="Batería"
            desc="Algunas marcas (Samsung, Xiaomi, Motorola) frenan apps en segundo plano. Si un aviso no suena, poné la app como 'Sin restricciones' en Ajustes > Batería."
          >
            <Btn small outline label="Abrir ajustes" onPress={() => Linking.openSettings()} />
          </Row>
          <Row title="Reprogramar todos los avisos" desc="Útil si cambiaste la hora del sistema o algo no sonó.">
            <Btn small outline label="Reprogramar" onPress={async () => { await rescheduleAll(); Alert.alert('Listo'); }} />
          </Row>

          <Text style={s.group}>Copia de seguridad</Text>
          <Row
            title="Exportar"
            desc="Genera un archivo con toda la agenda (hojas, dibujos, post-its, cuadernos, contactos, gastos…). No incluye los PDF importados ni los audios grabados. Guardalo en Drive, mail o un pendrive."
          >
            <Btn small label="⬆️ Exportar" onPress={doExport} />
          </Row>
          <Row title="Restaurar" desc="Carga un archivo de copia. Reemplaza los datos actuales.">
            <Btn small outline color={C.danger} label="⬇️ Restaurar" onPress={doImport} />
          </Row>

          <Text style={s.group}>Acerca de</Text>
          <Text style={s.rowDesc}>
            Mi Agenda 1.0 · Todos los datos se guardan solo en esta tablet. Los feriados son los nacionales de Argentina en su fecha nominal;
            los trasladables pueden moverse por decreto.
          </Text>
        </ScrollView>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.desk, padding: 14 },
  group: { marginTop: 18, marginBottom: 4, fontWeight: '900', color: C.accent, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, gap: 16 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  rowDesc: { fontSize: 13, color: C.inkSoft, marginTop: 2 },
  input: {
    width: 300, borderWidth: 1, borderColor: '#DDD2BF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 16, color: C.ink, backgroundColor: '#fff',
  },
});
