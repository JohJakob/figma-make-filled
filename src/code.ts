import clone from './clone';

let madeFilled = false;

const makeFilled = (selection) => {
  const fallbackColor = {r: 0, g: 0, b:0};

  for (const node of selection) {
    let strokes;

    // Only process visible nodes
    if (node.visible) {
      if (node.type === "ELLIPSE" || node.type === "POLYGON" || node.type === "STAR" || node.type === "RECTANGLE" || node.type === "VECTOR") {
        // Skip node if it is just a line
        if (node.type === "VECTOR" && node.vectorNetwork.segments.length < 2) {
          figma.notify("Lines cannot be filled.");
          continue;
        }

        // Skip node if it has no stroke
        if (node.strokeWeight === 0) {
          continue;
        }

        if ("strokes" in node) {
          // Save first stroke of node
          strokes = clone(node.strokes[0]);
        }

        // Clone node to be filled
        const fillNode = node.clone();

        // Reparent cloned node and set its position
        node.parent.appendChild(fillNode);
        fillNode.x = node.x;
        fillNode.y = node.y;

        // Remove strokes from cloned node
        fillNode.strokeStyleId = "";
        fillNode.strokes = [];

        // Create boolean operation node from original and cloned node
        const boolNode = figma.union([node, fillNode], node.parent);

        // Apply stroke of original node as fill for cloned node and boolean operation node
        if (node.strokeStyleId.length > 0) {
          fillNode.fillStyleId = node.strokeStyleId;
          boolNode.fillStyleId = node.strokeStyleId;
        } else if (strokes !== null) {
          fillNode.fills = [strokes];
          boolNode.fills = [strokes];
        } else {
          let fillNodeFills, boolNodeFills;

          fillNodeFills[0].color = fallbackColor;
          boolNodeFills[0].color = fallbackColor;

          fillNode.fills = fillNodeFills;
          boolNode.fills = boolNodeFills;
        }

        // Rename filled node and boolean operation node
        fillNode.name = fillNode.name + " (Filled)";
        boolNode.name = node.name;

        // Flatten boolean operation node if “Make Filled and Flatten” command is used
        if (figma.command === "make_filled_and_flatten") {
          figma.flatten([boolNode]);
        }

        madeFilled = true;
      } else if (node.type === "BOOLEAN_OPERATION" || node.type === "COMPONENT" || node.type === "FRAME" || node.type === "GROUP" || node.type === "INSTANCE") {
        // Process the children of boolean operation nodes, components, frames, groups, and instances
        makeFilled(node.children);
      } else {
        figma.notify("This layer type is not supported.");
      }

      // Notify user that no node was filled
      if (!madeFilled) {
        figma.notify("There is no layer that can be filled.");
      }
    }
  }
}

if (figma.currentPage.selection.length === 0) {
  figma.closePlugin("You have not selected anything.");
}

// Process selection
makeFilled(figma.currentPage.selection);

figma.closePlugin();
