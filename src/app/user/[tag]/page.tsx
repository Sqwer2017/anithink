import { UserClient } from "./user-client";

interface Props {
  params: { tag: string };
}

export default function UserPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6">
      <UserClient tag={params.tag} />
    </main>
  );
}
