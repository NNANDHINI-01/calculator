app.post("/api/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;

    // check if user exists in DB
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    // update password (hashing recommended)
    user.password = newPassword; // for production, use bcrypt.hash(newPassword, saltRounds)
    await user.save();

    res.json({ success: true, message: "Password updated successfully!" });
});