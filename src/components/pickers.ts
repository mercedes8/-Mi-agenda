import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

export function pickDate(value: Date, onPick: (d: Date) => void) {
  DateTimePickerAndroid.open({
    value,
    mode: 'date',
    onChange: (e, d) => {
      if (e.type === 'set' && d) onPick(d);
    },
  });
}

export function pickTime(value: Date, onPick: (d: Date) => void) {
  DateTimePickerAndroid.open({
    value,
    mode: 'time',
    is24Hour: true,
    onChange: (e, d) => {
      if (e.type === 'set' && d) onPick(d);
    },
  });
}
