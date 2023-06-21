// Import required libraries or modules

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

// Set up your server to listen for webhook requests
const app = express();

app.use(express.json());

app.post("/webhook", async (req, res) => {
  try {
    // Extract the event type and record ID from the payload
    const { type } = req.body;

    let orderRecordId = 0;

    if (type === "ADD_RECORD" || type === "UPDATE_RECORD") {
      // Handle order placement event
      const { record } = req.body;
      orderRecordId =  record.order_rn.value;
      if (type === "ADD_RECORD") {
        // Handle order placement event
        await handleOrderPlacement(orderRecordId);
      } else if (type === "UPDATE_RECORD") {
        // Handle order update event
        await handleOrderUpdate(orderRecordId);
      }
    } else if (type === "DELETE_RECORD") {
      // Handle order delete event
      const { recordId } = req.body;
      // await handleOrderDelete(recordId);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook payload:", error);
    res.sendStatus(500);
  }
});

// Functions to handle order events
async function handleOrderPlacement(recordId) {
  // Retrieve the order record from kintone based on the record ID
  const getOrderEndpoint = `https://${process.env.KINTONE_DOMAIN_NAME}.kintone.com/k/v1/record.json?app=${process.env.ORDER_TRACKING_APP_ID}&id=${recordId}`;
  const response = await fetch(getOrderEndpoint, {
    method: "GET",
    headers: {
      "X-Cybozu-API-Token": process.env.ORDER_TRACKING_APP_API_TOKEN,
    },
  });
  const { record } = await response.json();

  // Extract necessary information from the order record
  const orderType = record.order_type.value;
  const itemRecordId = record.item_rn.value;
  const orderedQuantity = record.qty.value;

  // Update the item master app's stock count based on the order type and ordered items
  if (orderType === "Purchase") {
    await updateItemMasterStockCount(itemRecordId, orderedQuantity, "increase");
  } else if (orderType === "Sale") {
    await updateItemMasterStockCount(itemRecordId, orderedQuantity, "decrease");
  }

  // Perform any other necessary actions for order placement event
  console.log("Order placed:", record);
}

async function handleOrderUpdate(recordId) {
  // Retrieve the updated order record from kintone based on the record ID
  const getOrderEndpoint = `https://${process.env.KINTONE_DOMAIN_NAME}.kintone.com/k/v1/record.json?app=${process.env.ORDER_TRACKING_APP_ID}&id=${recordId}`;
  const response = await fetch(getOrderEndpoint, {
    method: "GET",
    headers: {
      "X-Cybozu-API-Token": process.env.ORDER_TRACKING_APP_API_TOKEN,
    },
  });

  const { record } = await response.json();

  // Extract necessary information from the updated order record
  const orderType = record.order_type.value;
  const itemRecordId = record.item_rn.value;
  const orderedQuantity = record.qty.value;

  // Update the item master app's stock count based on the order type and updated ordered items
  if (orderType === "Purchase") {
    await updateItemMasterStockCount(itemRecordId, orderedQuantity, "increase");
  } else if (orderType === "Sale") {
    await updateItemMasterStockCount(itemRecordId, orderedQuantity, "decrease");
  }

  // Perform any necessary actions for order update event
  console.log("Order updated:", record);
}

async function handleOrderDelete(recordId) {
  // Retrieve the deleted order record from kintone based on the record ID (if needed)
  const getOrderEndpoint = `https://${process.env.KINTONE_DOMAIN_NAME}.kintone.com/k/v1/record.json?app=${process.env.ORDER_TRACKING_APP_ID}&id=${recordId}`;
  const response = await fetch(getOrderEndpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Cybozu-API-Token": process.env.ORDER_TRACKING_APP_API_TOKEN,
    },
  });
  const { record } = await response.json();

  // Extract necessary information from the deleted order record (if needed)
  const orderType = record.order_type.value;
  const orderedItems = record.ordered_items.value;

  // Update the item master app's stock count based on the order type and ordered items
  if (orderType === "Purchase") {
    await updateItemMasterStockCount(orderedItems, "decrease");
  } else if (orderType === "Sale") {
    await updateItemMasterStockCount(orderedItems, "increase");
  }

  // Perform any necessary actions for order delete event
  console.log("Order deleted:", record);
}

// Start the server
const server = app.listen(3000, () => {
  console.log("Webhook server is running on port 3000");
});

// Function to update the item master app's stock count
async function updateItemMasterStockCount(itemRecordId, orderedQuantity, action) {
  // Iterate over the ordered items and update the stock count

  // Retrieve the current stock count of the item from the item master app
  const getItemEndpoint = `https://${process.env.KINTONE_DOMAIN_NAME}.kintone.com/k/v1/record.json?app=${process.env.ITEMS_MASTER_APP_ID}&id=${itemRecordId}`;

  const response = await fetch(getItemEndpoint, {
    method: "GET",
    headers: {
      "X-Cybozu-API-Token": process.env.ITEMS_MASTER_APP_API_TOKEN,
    },
  });
  const { record } = await response.json();

  const currentStockCount = record.stock.value;

  // Calculate the updated stock count based on the action (increase or decrease)
  let updatedStockCount;
  if (action === "increase") {
    updatedStockCount = Number(currentStockCount) + Number(orderedQuantity);
  } else if (action === "decrease") {
    updatedStockCount = Number(currentStockCount) - Number(orderedQuantity);
  }

  // Update the stock count in the item master app
  const updateItemEndpoint = `https://${process.env.KINTONE_DOMAIN_NAME}.kintone.com/k/v1/record.json`;
  const ress = await fetch(updateItemEndpoint, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Cybozu-API-Token": process.env.ITEMS_MASTER_APP_API_TOKEN,
    },
    body: JSON.stringify({
      app: process.env.ITEMS_MASTER_APP_ID,
      id: itemRecordId,
      record: {
        stock: {
          value: updatedStockCount,
        },
      }
    }),
  });
}
