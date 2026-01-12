const styles = {
  page: "min-h-screen bg-gray-50 text-gray-900 font-sans",
  container: "max-w-7xl mx-auto px-4 py-8 md:px-6 md:py-12",
  header: "bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm",
  h1: "text-2xl font-display font-bold text-primary mb-1",
  sub: "text-sm text-gray-500 mt-1",
  section: "bg-white border border-gray-200 rounded-xl p-6 mt-6 shadow-sm",
  sectionTitle: "text-lg font-bold text-primary mb-4 border-b border-gray-100 pb-2",
  grid2: "grid grid-cols-1 md:grid-cols-2 gap-6",
  blockFull: "col-span-1 md:col-span-2",
  label: "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2",
  // Base input classes (error state handling must be done in component via template literal)
  input: "w-full px-4 py-2.5 rounded-lg border bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
  select: "w-full px-4 py-2.5 rounded-lg border bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none bg-no-repeat bg-[right_1rem_center]",
  textarea: "w-full px-4 py-2.5 rounded-lg border bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[80px]",
  metaText: "text-xs text-gray-500 mt-1",
  btn: "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  btnPrimary: "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover shadow-sm shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
  tableWrap: "overflow-x-auto border border-gray-200 rounded-lg",
  table: "w-full border-collapse text-left",
  th: "px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider",
  td: "px-4 py-3 border-b border-gray-100 text-sm",
  tFootCell: "px-4 py-3 bg-gray-50 font-bold text-gray-900",
  error: "text-red-600 text-sm mt-1",
  arInline: "font-semibold text-primary"
}

export default styles