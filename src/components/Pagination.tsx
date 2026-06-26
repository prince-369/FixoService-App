import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Brand } from '@/lib/config';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, currentPage === 1 && styles.btnDisabled]}
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={14} color={currentPage === 1 ? Brand.textLight : Brand.text} />
        <Text style={[styles.btnText, currentPage === 1 && styles.btnTextDisabled]}>Previous</Text>
      </TouchableOpacity>

      <Text style={styles.pageText}>Page {currentPage} of {totalPages}</Text>

      <TouchableOpacity
        style={[styles.btn, currentPage === totalPages && styles.btnDisabled]}
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnText, currentPage === totalPages && styles.btnTextDisabled]}>Next</Text>
        <Ionicons name="chevron-forward" size={14} color={currentPage === totalPages ? Brand.textLight : Brand.text} />
      </TouchableOpacity>
    </View>
  );
}

export function paginateItems<T>(items: T[], page: number, perPage = 7): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

export function getTotalPages<T>(items: T[], perPage = 7): number {
  return Math.max(1, Math.ceil(items.length / perPage));
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 12, fontWeight: '700', color: Brand.text },
  btnTextDisabled: { color: Brand.textLight },
  pageText: { fontSize: 11, fontWeight: '600', color: Brand.textMuted },
});
