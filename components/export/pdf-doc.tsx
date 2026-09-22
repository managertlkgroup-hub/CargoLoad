/* Не импортируется напрямую из серверного бандла — подключается через
 * await import("@/components/export/pdf-doc") в lib/export/pdf.tsx. */

import {
  Document,
  Page,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

export interface PdfBox {
  /** мм в координатах слоя (X слева направо) */
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface PdfLayer {
  index: number;
  /** высота слоя, отформатирована (мм) */
  z: string;
  /** размеры поля слоя в мм */
  L: number;
  W: number;
  boxes: PdfBox[];
  /** легенда этого слоя (уникальные грузы) */
  legend: Array<{ color: string; name: string }>;
}

export interface PdfData {
  title: string;
  subtitle: string;
  vehicleName: string;
  vehicleMeta: string;
  generatedAt: string;
  /** разделы: «Параметры раскладки», «Грузы», «Схемы по слоям», «Инструкция» */
  sections: {
    params: string;
    metrics: string;
    goods: string;
    schemes: string;
    instructions: string;
  };
  params: Array<{ label: string; value: string }>;
  metrics: Array<{ label: string; value: string; tone?: "ok" | "warn" | "crit" }>;
  goods: Array<{
    name: string;
    color: string;
    placed: number;
    total: number;
    weight: string;
  }>;
  goodsHeader: { name: string; placed: string; qty: string; weight: string };
  unplaced: Array<{ name: string; qty: number; weight: string; reason: string }>;
  layers: PdfLayer[];
  instruction: { title: string; paragraphs: string[] };
  footer: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9,
    color: "#1c1b29",
    padding: 28,
    backgroundColor: "#ffffff",
  },
  h1: { fontSize: 18, fontWeight: "bold", color: "#241f3d" },
  h2: { fontSize: 13, fontWeight: "bold", color: "#4c3fd1" },
  meta: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  gridItem: { width: "50%" },
  section: { marginTop: 14 },
  label: { color: "#6b7280" },
  value: { color: "#1c1b29", textAlign: "right" },
  table: { width: "100%", marginTop: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e1f5" },
  tableCell: { paddingVertical: 3, paddingRight: 6 },
  swatch: { width: 9, height: 9, borderRadius: 2, marginRight: 6 },
  toneOk: { color: "#0f7b46" },
  toneWarn: { color: "#b45309" },
  toneCrit: { color: "#b91c1c", fontWeight: "bold" },
  schemeBox: { borderWidth: 1, borderColor: "#e5e1f5", borderRadius: 6, marginTop: 8, padding: 10 },
  schemeTitle: { fontSize: 10, fontWeight: "bold", color: "#241f3d", marginBottom: 6 },
  schemeLegend: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  schemeLegendItem: { flexDirection: "row", alignItems: "center", marginRight: 14, marginBottom: 2 },
  note: { fontSize: 8.5, color: "#6b7280", marginTop: 3 },
  footer: { fontSize: 8, color: "#9ca3af", marginTop: 20, textAlign: "center" },
});

export function PdfDocument({ data }: { data: PdfData }) {
  return (
    <Document title={data.title} author="CargoPlanner">
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{data.title}</Text>
        <Text style={styles.meta}>{data.subtitle}</Text>
        <Text style={styles.meta}>
          {data.vehicleName} · {data.vehicleMeta}
        </Text>
        <Text style={styles.meta}>{data.generatedAt}</Text>

        {data.params.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>{data.sections.params}</Text>
            <View style={styles.grid}>
              {data.params.map((p) => (
                <View key={p.label} style={styles.gridItem}>
                  <View style={styles.row}>
                    <Text style={styles.label}>{p.label}</Text>
                    <Text style={styles.value}>{p.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {data.metrics.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>{data.sections.metrics}</Text>
            <View style={styles.grid}>
              {data.metrics.map((m) => (
                <View key={m.label} style={styles.gridItem}>
                  <View style={styles.row}>
                    <Text style={styles.label}>{m.label}</Text>
                    <Text
                      style={[
                        styles.value,
                        m.tone === "ok" ? styles.toneOk : undefined,
                        m.tone === "warn" ? styles.toneWarn : undefined,
                        m.tone === "crit" ? styles.toneCrit : undefined,
                      ]}
                    >
                      {m.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {data.goods.length > 0 && <GoodsSection data={data} />}

        {data.layers.length > 0 && <SchemesSection data={data} />}

        <View style={styles.section}>
          <Text style={styles.h2}>{data.instruction.title}</Text>
          {data.instruction.paragraphs.map((p) => (
            <Text key={p} style={{ marginTop: 4, lineHeight: 1.5 }}>
              {p}
            </Text>
          ))}
        </View>

        <Text style={styles.footer}>{data.footer}</Text>
      </Page>
    </Document>
  );
}

function GoodsSection({ data }: { data: PdfData }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{data.sections.goods}</Text>
      <View style={styles.table}>
        <View style={styles.tableRow} wrap={false}>
          <View style={[styles.tableCell, { width: "38%" }]}>
            <Text style={styles.label}>{data.goodsHeader.name}</Text>
          </View>
          <View style={[styles.tableCell, { width: "24%", alignItems: "flex-end" }]}>
            <Text style={styles.label}>{data.goodsHeader.placed}</Text>
          </View>
          <View style={[styles.tableCell, { width: "14%", alignItems: "flex-end" }]}>
            <Text style={styles.label}>{data.goodsHeader.qty}</Text>
          </View>
          <View style={[styles.tableCell, { width: "24%", alignItems: "flex-end" }]}>
            <Text style={styles.label}>{data.goodsHeader.weight}</Text>
          </View>
        </View>
        {data.goods.map((g) => (
          <View key={g.name} style={styles.tableRow} wrap={false}>
            <View style={[styles.tableCell, { width: "38%", flexDirection: "row", alignItems: "center" }]}>
              <View style={[styles.swatch, { backgroundColor: g.color }]} />
              <Text>{g.name}</Text>
            </View>
            <View style={[styles.tableCell, { width: "24%", alignItems: "flex-end" }]}>
              <Text>{g.placed} / {g.total}</Text>
            </View>
            <View style={[styles.tableCell, { width: "14%", alignItems: "flex-end" }]}>
              <Text>{g.placed}</Text>
            </View>
            <View style={[styles.tableCell, { width: "24%", alignItems: "flex-end" }]}>
              <Text>{g.weight}</Text>
            </View>
          </View>
        ))}
      </View>
      {data.unplaced.length > 0 && (
        <View style={{ marginTop: 6 }}>
          {data.unplaced.map((u) => (
            <Text key={u.name + u.reason} style={styles.note}>
              {u.name} ×{u.qty} · {u.weight} — {u.reason}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function SchemesSection({ data }: { data: PdfData }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.h2}>{data.sections.schemes}</Text>
      {data.layers.map((layer) => (
        <View key={layer.index} style={styles.schemeBox}>
          <Text style={styles.schemeTitle}>
            Слой {layer.index + 1} · z = {layer.z}
          </Text>
          <Svg viewBox={`0 0 ${layer.L} ${layer.W}`} style={{ width: "100%", height: 120 }}>
            {layer.boxes.map((b, i) => (
              <Rect
                key={i}
                x={b.x}
                y={b.y}
                width={Math.max(0.5, b.w)}
                height={Math.max(0.5, b.h)}
                fill={b.color}
                opacity={0.82}
              />
            ))}
          </Svg>
          <View style={styles.schemeLegend}>
            {layer.legend.map((l) => (
              <View key={l.name} style={styles.schemeLegendItem}>
                <View style={[styles.swatch, { backgroundColor: l.color }]} />
                <Text>{l.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}