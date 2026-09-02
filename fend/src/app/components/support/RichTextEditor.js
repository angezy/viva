"use client";

import dynamic from "next/dynamic";
import { Typography } from "@mui/material";

const Editor = dynamic(() => import("@tinymce/tinymce-react").then((module) => module.Editor), { ssr: false });

export default function RichTextEditor({ label = "Message", value = "", onChange, minHeight = 240 }) {
  return (
    <div>
      <Typography component="label" sx={{ display: "block", color: "var(--color-text-secondary)", fontSize: 13, fontWeight: 800, mb: 0.75 }}>
        {label}
      </Typography>
      <Editor
        apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || "no-api-key"}
        value={value}
        init={{
          height: minHeight,
          menubar: false,
          plugins: ["lists", "link", "image", "table", "fullscreen", "code"],
          toolbar: "undo redo | blocks | bold italic removeformat | bullist numlist | link image table | fullscreen code",
          branding: false,
          promotion: false,
          content_style: "body { font-family: Inter, Arial, sans-serif; font-size: 14px; padding: 10px; color: #242321; }",
        }}
        onEditorChange={onChange}
      />
    </div>
  );
}
