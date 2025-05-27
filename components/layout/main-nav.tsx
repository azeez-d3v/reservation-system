"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { Menu } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function MainNav() {
	const pathname = usePathname()
	const { data: session } = useSession()
	const isMobile = useIsMobile()
	const [isMenuOpen, setIsMenuOpen] = useState(false)

	// Mobile menu
	const MobileMenu = () => (
		<Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Menu">
					<Menu className="h-5 w-5" />
				</Button>
			</SheetTrigger>
			<SheetContent side="left" className="w-[240px] sm:w-[300px]">
				<SheetHeader className="text-left">
					<SheetTitle>Menu</SheetTitle>
				</SheetHeader>
				<div className="flex flex-col gap-4 py-4">
					<Link
						href="/"
						className="font-bold text-lg"
						onClick={() => setIsMenuOpen(false)}
					>
						Home
					</Link>
					{session?.user && (
						<>
							<Link
								href="/dashboard"
								className={cn(
									"py-2 transition-colors hover:text-foreground/80",
									pathname === "/dashboard" ? "text-foreground font-medium" : "text-foreground/60",
								)}
								onClick={() => setIsMenuOpen(false)}
							>
								Dashboard
							</Link>
							{session.user.role === "admin" && (
								<Link
									href="/admin"
									className={cn(
										"py-2 transition-colors hover:text-foreground/80",
										pathname === "/admin" ? "text-foreground font-medium" : "text-foreground/60",
									)}
									onClick={() => setIsMenuOpen(false)}
								>
									Admin
								</Link>
							)}
							<Link
								href="/request"
								className={cn(
									"py-2 transition-colors hover:text-foreground/80",
									pathname === "/request" ? "text-foreground font-medium" : "text-foreground/60",
								)}
								onClick={() => setIsMenuOpen(false)}
							>
								New Reservation
							</Link>
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	)

	// Desktop navigation
	const DesktopNav = () => (
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

	return isMobile ? <MobileMenu /> : <DesktopNav />
}
