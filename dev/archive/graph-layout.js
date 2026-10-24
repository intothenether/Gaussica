window.MATTE_GRAPH_LAYOUT = {
  node: {
    minWidth: 190,
    maxWidth: 232,
    height: 116
  },
  spacing: {
    horizontal: 20,
    vertical: 144,
    levelLabel: 22
  },
  canvas: {
    horizontalPadding: 20,
    topPadding: 22,
    bottomPadding: 20,
    minHeight: 220
  },
  labels: {
    start: "STARTA HÄR",
    level: "BYGG VIDARE · NIVÅ "
  },

  calculate: function (layers, width) {
    const settings = this;
    const depths = Array.from(layers.keys()).sort(function (a, b) { return a - b; });
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

    depths.forEach(function (depth) {
      const lessons = layers.get(depth);
      const rows = Math.ceil(lessons.length / columns);
      const levelTop = height;
      height += settings.spacing.levelLabel + rows * settings.spacing.vertical +
        settings.canvas.bottomPadding;

      lessons.forEach(function (lesson, index) {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const rowCount = Math.min(columns, lessons.length - row * columns);
        const rowWidth = rowCount * nodeWidth +
          (rowCount - 1) * settings.spacing.horizontal;
        positions.set(lesson.id, {
          x: (width - rowWidth) / 2 + column * (nodeWidth + settings.spacing.horizontal),
          y: levelTop + settings.spacing.levelLabel + row * settings.spacing.vertical,
          width: nodeWidth,
          height: settings.node.height,
          levelTop: levelTop,
          depth: depth
        });
      });
    });

    return {
      width: width,
      height: Math.max(settings.canvas.minHeight, height),
      positions: positions,
      levels: depths
    };
  },

  edgePath: function (source, target) {
    const startX = source.x + source.width / 2;
    const startY = source.y + source.height;
    const endX = target.x + target.width / 2;
    const endY = target.y - 8;
    const curve = Math.max(24, (endY - startY) / 2);
    return "M " + startX + " " + startY + " C " +
      startX + " " + (startY + curve) + ", " +
      endX + " " + (endY - curve) + ", " + endX + " " + endY;
  }
};
