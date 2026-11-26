import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AgendaAlarm } from '../../modules/agenda-alarm';
import { useApp } from '../AppState';
import { Btn, Chip, Sheet, Title } from '../components/ui';
import { bump, exportAll, importAll, useSetting } from '../db';
import { ymd } from '../dates';
import { exactAlarmStatus, requestExactAlarm, rescheduleAll, setupNotifications, testNotification } from '../notifications';
import {
  bioAuth, bioAvailable, bioLabel, checkPassword, clearPassword, pickCoverPhoto, removeCoverPhoto, setPassword,
} from '../security';
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
  const [photo] = useSetting('coverPhoto', '');
  const [bio, setBio] = useSetting('lockBio', '0');
  const [lockAfter, setLockAfter] = useSetting('lockAfter', '1');
  const [pwHash] = useSetting('lockHash', '');
  const hasPw = !!pwHash;
  const locked = hasPw || bio === '1';
  const [pwModal, setPwModal] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [bioText, setBioText] = useState('huella o rostro');
  useEffect(() => {
    bioAvailable().then(setBioOk);
    bioLabel().then(setBioText);
  }, []);
  const [exactOk, setExactOk] = useState(true);
  const [fullOk, setFullOk] = useState(true);
  useEffect(() => {
    exactAlarmStatus().then(setExactOk);
    try {
      setFullOk(AgendaAlarm?.canUseFullScreen() ?? true);
    } catch {}
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

          <Text style={s.group}>Tapa y seguridad</Text>
          <Row title="Nombre de quien la usa" desc="Aparece en la tapa y al pie de cada hoja.">
            <TextInput style={s.input} value={owner} onChangeText={setOwner} placeholder="Tu nombre" placeholderTextColor="#B8AFA2" />
          </Row>
          <Row title="Contacto si se pierde" desc="Opcional. Se muestra en la tapa.">
            <TextInput style={s.input} value={contact} onChangeText={setContact} placeholder="Teléfono o email" placeholderTextColor="#B8AFA2" />
          </Row>
          <Row title="Foto de portada" desc="Opcional. Aparece pegada en la tapa, como una foto con cinta.">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {photo ? <Image source={{ uri: photo }} style={s.thumb} /> : null}
              <Btn small outline label="🖼️ Galería" onPress={() => pickCoverPhoto('gallery')} />
              <Btn small outline label="📷 Cámara" onPress={() => pickCoverPhoto('camera')} />
              {photo ? <Btn small outline color={C.danger} label="Quitar" onPress={removeCoverPhoto} /> : null}
            </View>
          </Row>
          <Row
            title="Mostrar la tapa al abrir la app"
            desc={locked ? 'Con el bloqueo activado, la tapa siempre aparece.' : undefined}
          >
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Switch
                value={showCover === '1' || locked}
                disabled={locked}
                onValueChange={(v) => setShowCover(v ? '1' : '0')}
                trackColor={{ true: C.accent }}
              />
              <Btn small outline label="📕 Ver la tapa" onPress={() => setCoverVisible(true)} />
            </View>
          </Row>
          <Row
            title="🔒 Contraseña"
            desc={hasPw ? 'La agenda pide contraseña para abrirse.' : 'Opcional. Protegé tu agenda con una contraseña.'}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn small label={hasPw ? 'Cambiar' : 'Crear contraseña'} onPress={() => setPwModal(true)} />
              {hasPw && (
                <Btn
                  small
                  outline
                  color={C.danger}
                  label="Quitar"
                  onPress={() =>
                    Alert.alert('Quitar contraseña', '¿Querés que la agenda se abra sin contraseña?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Quitar', style: 'destructive', onPress: clearPassword },
                    ])
                  }
                />
              )}
            </View>
          </Row>
          <Row
            title={`👆 Abrir con ${bioText}`}
            desc={
              bioOk
                ? 'Usa la huella o el desbloqueo facial con la cámara que tengas configurado en la tablet.'
                : 'La tablet no tiene huella ni rostro configurados. Configuralos en Ajustes de Android > Seguridad.'
            }
          >
            <Switch
              value={bio === '1'}
              disabled={!bioOk}
              onValueChange={async (v) => {
                if (v && !(await bioAuth())) return;
                setBio(v ? '1' : '0');
              }}
              trackColor={{ true: C.accent }}
            />
          </Row>
          {locked && (
            <Row title="Volver a bloquear" desc="Cuando volvés a la agenda después de usar otra app.">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 380 }}>
                {LOCK_AFTER.map(([v, l]) => (
                  <Chip key={v} label={l} active={lockAfter === v} onPress={() => setLockAfter(v)} />
                ))}
              </View>
            </Row>
          )}

          <Text style={s.group}>Escritura a mano</Text>
          <Row
            title="Solo lápiz óptico"
            desc="Si lo activás, en modo lápiz se ignoran los dedos (evita marcas al apoyar la mano). Funciona con S Pen y lápices activos."
          >
            <Switch value={stylusOnly === '1'} onValueChange={(v) => setStylusOnly(v ? '1' : '0')} trackColor={{ true: C.accent }} />
          </Row>

          <Text style={s.group}>Recordatorios y sonido</Text>
          <Row
            title="Probar alarma"
            desc="En 3 segundos suena una alarma de prueba. Los recordatorios suenan con el volumen de ALARMA, así que se escuchan aunque la tablet esté en silencio."
          >
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
          {AgendaAlarm && !fullOk && (
            <Row
              title="Mostrar en pantalla completa"
              desc="⚠️ Android no deja que la alarma aparezca en pantalla completa. Activalo para ver el recordatorio aunque la tablet esté bloqueada."
            >
              <Btn small label="Activar" onPress={() => AgendaAlarm?.openFullScreenSettings()} />
            </Row>
          )}
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
      <PasswordModal visible={pwModal} change={hasPw} onClose={() => setPwModal(false)} />
    </View>
  );
}

const LOCK_AFTER: [string, string][] = [['0', 'Enseguida'], ['1', '1 minuto'], ['5', '5 minutos'], ['15', '15 minutos'], ['-1', 'Solo al abrir la app']];

function PasswordModal({ visible, change, onClose }: { visible: boolean; change: boolean; onClose: () => void }) {
  const [cur, setCur] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  const close = () => {
    setCur('');
    setA('');
    setB('');
    setErr('');
    onClose();
  };
  const save = async () => {
    if (change && !(await checkPassword(cur))) return setErr('La contraseña actual no es correcta.');
    if (a.length < 4) return setErr('Usá al menos 4 caracteres.');
    if (a !== b) return setErr('Las dos contraseñas no coinciden.');
    await setPassword(a);
    bump();
    close();
    Alert.alert('Listo', 'La próxima vez que abras la agenda te va a pedir la contraseña.');
  };
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <Sheet style={{ width: 440 }}>
          <Title>{change ? 'Cambiar contraseña' : 'Crear contraseña'}</Title>
          {change && (
            <TextInput style={s.pw} placeholder="Contraseña actual" secureTextEntry value={cur} onChangeText={setCur} placeholderTextColor="#B8AFA2" />
          )}
          <TextInput style={s.pw} placeholder="Contraseña nueva" secureTextEntry value={a} onChangeText={setA} placeholderTextColor="#B8AFA2" autoFocus />
          <TextInput style={s.pw} placeholder="Repetila" secureTextEntry value={b} onChangeText={setB} placeholderTextColor="#B8AFA2" onSubmitEditing={save} />
          {err ? <Text style={{ color: C.danger, marginBottom: 8 }}>{err}</Text> : null}
          <Text style={{ color: C.inkSoft, fontSize: 12, marginBottom: 10 }}>
            Si la olvidás, vas a poder entrar con el bloqueo de pantalla de la tablet (PIN, patrón, huella o rostro).
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Btn label="Cancelar" outline color={C.inkSoft} onPress={close} />
            <Btn label="Guardar" onPress={save} />
          </View>
        </Sheet>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.desk, padding: 14 },
  group: { marginTop: 18, marginBottom: 4, fontWeight: '900', color: C.accent, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, gap: 16 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  rowDesc: { fontSize: 13, color: C.inkSoft, marginTop: 2 },
  thumb: { width: 44, height: 55, borderRadius: 4, backgroundColor: '#ddd' },
  backdrop: { flex: 1, backgroundColor: '#0007', alignItems: 'center', justifyContent: 'center' },
  pw: {
    borderWidth: 1, borderColor: '#DDD2BF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10,
    fontSize: 17, color: C.ink, backgroundColor: '#fff', marginBottom: 10,
  },
  input: {
    width: 300, borderWidth: 1, borderColor: '#DDD2BF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 16, color: C.ink, backgroundColor: '#fff',
  },
});
