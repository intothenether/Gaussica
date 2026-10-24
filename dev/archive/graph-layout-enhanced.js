// Enhanced Graph Layout with Difficulty Progression
// Organizes lessons by skill level (depth) from simple to complex
// Also supports visual clustering by subject area

window.MATTE_GRAPH_LAYOUT_ENHANCED = {
  node: {
    minWidth: 160,
    maxWidth: 200,
    height: 100
  },
  spacing: {
    horizontal: 24,
    vertical: 160,
    levelLabel: 28,
    areaGap: 40
  },
  canvas: {
    horizontalPadding: 32,
    topPadding: 32,
    bottomPadding: 32,
    minHeight: 250
  },
  colors: {
    "tal": "#365b46",           // Dark green - foundational
    "geometri": "#8ba483",      // Light green - spatial
    "algebra": "#5a7a6b",       // Medium green - abstract
    "matning": "#7a9a8b",       // Muted green - practical
    "data": "#6a8a7b"           // Neutral green - analytical
  },
  labels: {
    start: "STARTA HÄR",
    level: "NIVÅ "
  },

  // Calculate layout with difficulty progression
  calculate: function (layersOrLessons, width) {
    // Handle both signatures: original (layers Map) and enhanced (lessons array)
    let lessons = layersOrLessons;
    if (layersOrLessons instanceof Map) {
      // Convert Map<depth, lessons[]> back to flat array
      lessons = [];
      layersOrLessons.forEach(layer => {
        lessons = lessons.concat(layer);
      });
    }
    
    const settings = this;
    
    // Build prerequisite graph
    const depthMap = new Map();
    
    function calculateDepth(lesson) {
      if (depthMap.has(lesson.id)) return depthMap.get(lesson.id);
      
      if (!lesson.prerequisites || lesson.prerequisites.length === 0) {
        depthMap.set(lesson.id, 0);
        return 0;
      }
      
      const maxPrereqDepth = Math.max(
        ...lesson.prerequisites.map(prereqId => {
          const prereq = lessons.find(l => l.id === prereqId);
          return prereq ? calculateDepth(prereq) : 0;
        })
      );
      
      const depth = maxPrereqDepth + 1;
      depthMap.set(lesson.id, depth);
      return depth;
    }
    
    // Calculate depth for all lessons
    lessons.forEach(lesson => calculateDepth(lesson));
    
    // Group lessons by depth
    const layers = new Map();
    lessons.forEach(lesson => {
      const depth = depthMap.get(lesson.id);
      if (!layers.has(depth)) layers.set(depth, []);
      layers.get(depth).push(lesson);
    });
    
    // Sort each layer by area (for visual clustering)
    const areaOrder = ["tal", "algebra", "geometri", "matning", "data"];
    layers.forEach(layer => {
      layer.sort((a, b) => {
        const areaA = areaOrder.indexOf(a.area);
        const areaB = areaOrder.indexOf(b.area);
        return (areaA >= 0 ? areaA : 999) - (areaB >= 0 ? areaB : 999);
      });
    });
    
    // Calculate positions
    const depths = Array.from(layers.keys()).sort((a, b) => a - b);
    const columns = Math.max(1, Math.floor(
      (width - settings.canvas.horizontalPadding * 2 + settings.spacing.horizontal) /
      (settings.node.minWidth + settings.spacing.horizontal)
    ));
    const nodeWidth = Math.min(
      settings.node.maxWidth,
      (width - settings.canvas.horizontalPadding * 2 -
        settings.spacing.horizontal * (columns - 1)) / columns
    );
    
    const positions = new Map();
    let height = settings.canvas.topPadding;
    
    depths.forEach(depth => {
      const layerLessons = layers.get(depth);
      const rows = Math.ceil(layerLessons.length / columns);
      const levelTop = height;
      
      height += settings.spacing.levelLabel + rows * settings.spacing.vertical + settings.spacing.areaGap;
      
      layerLessons.forEach((lesson, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const rowCount = Math.min(columns, layerLessons.length - row * columns);
        const rowWidth = rowCount * nodeWidth + (rowCount - 1) * settings.spacing.horizontal;
        
        positions.set(lesson.id, {
          x: (width - rowWidth) / 2 + column * (nodeWidth + settings.spacing.horizontal),
          y: levelTop + settings.spacing.levelLabel + row * settings.spacing.vertical,
          width: nodeWidth,
          height: settings.node.height,
          levelTop: levelTop,
          depth: depth,
          area: lesson.area
        });
      });
    });
    
    return {
      width: width,
      height: Math.max(settings.canvas.minHeight, height),
      positions: positions,
      levels: depths,
      depthMap: depthMap
    };
  },

  edgePath: function (source, target) {
    const startX = source.x + source.width / 2;
    const startY = source.y + source.height;
    const endX = target.x + target.width / 2;
    const endY = target.y - 8;
    const curve = Math.max(32, (endY - startY) / 2.5);
    return "M " + startX + " " + startY + " C " +
      startX + " " + (startY + curve) + ", " +
      endX + " " + (endY - curve) + ", " + endX + " " + endY;
  },

  // Get color for lesson node based on area
  getNodeColor: function (area) {
    return this.colors[area] || "#728076";
  }
};

// Export for both module and global use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.MATTE_GRAPH_LAYOUT_ENHANCED;
}
