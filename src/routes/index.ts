import express from 'express';
const router = express.Router();

router.get("/", (req, res) => {
  res.render("theme2");
});
// router.get("/", (req, res) => {
//   res.send("index");
// });

export default router;