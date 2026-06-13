import * as lineService from "./line.service.js";

export async function webhook(req, res) {
  try {
    const result = await Promise.all(req.body.events.map(lineService.handleEvent));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
}
