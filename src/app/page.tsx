import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { ChatPage } from "./chat-page";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <ChatPage />;
}
