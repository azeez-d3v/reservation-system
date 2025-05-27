"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

export function MainNav() {
	const pathname = usePathname()
	const { data: session } = useSession()

	return (
		<div className="flex">
			<Link href="/" className="flex items-center">
				<span className="font-bold">Reservation System</span>
			</Link>
			<nav className="flex items-center ml-8 space-x-6 text-sm font-medium">
				{session?.user ? (
					<>
						<Link
							href="/dashboard"
							className={cn(
								"transition-colors hover:text-foreground/80",
								pathname === "/dashboard" ? "text-foreground" : "text-foreground/60",
							)}
						>
							Dashboard
						</Link>
						{session.user.role === "admin" && (
							<Link
								href="/admin"
								className={cn(
									"transition-colors hover:text-foreground/80",
									pathname === "/admin" ? "text-foreground" : "text-foreground/60",
								)}
							>
								Admin
							</Link>
						)}
					</>
				) : null}
			</nav>
		</div>
	)
}
