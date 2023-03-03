import clone from './clone';

const noSelectionMessage = 'You have not selected anything.';
const nothingToMergeMessage = 'There are no layers in the selection that can be merged.';

let madeFilled = false;
let nodesToMerge = [];

const makeFilled = (selection) => {
  fill(selection);
}

const fill = (selection) => {
  if (selection.length === 0) {
    figma.closePlugin(noSelectionMessage);
  }

  const fallbackColor = { r: 0, g: 0, b: 0 };

  for (const node of selection) {
    let strokes;

    // Only process visible nodes
    if (node.visible) {
      if (node.type === 'BOOLEAN_OPERATION') {
        // Process children of boolean operation nodes
        fill(node.children);
      }

      if (node.type === 'ELLIPSE' || node.type === 'POLYGON' || node.type === 'STAR' || node.type === 'RECTANGLE' || node.type === 'VECTOR' || node.type === 'LINE' || node.type === 'BOOLEAN_OPERATION') {
        // Skip node if it is just a line
        if (node.type === 'LINE' || node.type === 'VECTOR' && node.vectorNetwork.segments.length < 2) {
          // Directly push lines into the array for merging later
          nodesToMerge.push(node);

          figma.notify('Lines cannot be filled.');
          continue;
        }

        // Skip node if it has no stroke
        if (node.strokes.length === 0) {
          continue;
        }

        // Save first stroke of node
        strokes = clone(node.strokes[0]);

        // Remove fills from node
        node.fillStyleId = '';
        node.fills = [];

        // Clone node to be filled
        const fillNode = node.clone();

        // Reparent cloned node and set its position and rotation
        node.parent.appendChild(fillNode);
        fillNode.x = node.x;
        fillNode.y = node.y;
        fillNode.rotation = node.rotation;

        // Remove strokes from cloned node
        fillNode.strokeStyleId = '';
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
        fillNode.name = fillNode.name + ' (Filled)';
        boolNode.name = node.name;

        // Flatten boolean operation node if “Make Filled and Flatten” command is used
        if (figma.command === 'make_filled_and_flatten') {
          figma.flatten([boolNode]);
        }

        // Push the boolean operation node into the array for merging
        if (figma.command === 'make_filled_and_merge') {
          nodesToMerge.push(boolNode);
        }

        madeFilled = true;
      } else if (node.type === 'COMPONENT' || node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'INSTANCE') {
        // Process the children of components, frames, groups, and instances
        fill(node.children);
      } else {
        figma.notify('This layer type is not supported.');
      }

      // Notify user that no node was filled
      if (!madeFilled) {
        figma.notify('There is no layer that can be filled.');
      }
    }
  }
}

const merge = (nodes) => {
  // Get parent of the first node
  const parent = nodes[0].parent;

  // Create a boolean operation node of all nodes
  const mergedNodes = figma.union(nodes, parent);

  // Apply the fills (or fill style ID or stroke style ID) of the first node to the boolean operation node
  mergedNodes.fills = nodes[0].fills;
  mergedNodes.fillStyleId = nodes[0].fillStyleId !== '' ? nodes[0].fillStyleId : nodes[0].strokeStyleId;

  // Flatten the boolean operation node
  const flattenedNode = figma.flatten([mergedNodes]);

  // Set the flattened node as the new selection and empty the global array of nodes to merge
  figma.currentPage.selection = [flattenedNode];
  nodesToMerge = [];
}

figma.on('run', ({ command }) => {
  switch (command) {
    case 'make_filled':
      makeFilled(figma.currentPage.selection);
      break;
    case 'make_filled_and_flatten':
      makeFilled(figma.currentPage.selection);
      break;
    case 'make_filled_and_merge':
      makeFilled(figma.currentPage.selection);
      merge(nodesToMerge);
      break;
    case 'create_filled_variant':
      break;
    default:
      break;
  }

  figma.closePlugin();
});
