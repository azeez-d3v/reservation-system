"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { 
	Menu, 
	Home, 
	LayoutDashboard, 
	Settings, 
	Calendar, 
	User,
	ChevronRight 
} from "lucide-react"
import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
			<SheetContent side="left" className="w-[280px] sm:w-[320px] p-0">
				<div className="flex flex-col h-full">
					{/* Header */}
					<SheetHeader className="p-6 pb-4 space-y-4">
						<div className="flex items-center space-x-3">
							<div className="w-8 h-8 rounded-lg flex items-center justify-center p-1">
								<Image
									src="/logo.svg"
									alt="Reservation System Logo"
									width={52}
									height={52}
									className="w-6 h-6"
								/>
							</div>
							<SheetTitle className="text-left font-semibold">
								Menu
							</SheetTitle>
						</div>
					</SheetHeader>

					<Separator />

					{/* Navigation */}
					<nav className="flex-1 px-6 py-4">
						<div className="space-y-2">
							{/* Home */}
							<Link
								href="/"
								className={cn(
									"flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors group",
									pathname === "/" 
										? "bg-primary text-primary-foreground" 
										: "hover:bg-muted text-foreground/70 hover:text-foreground"
								)}
								onClick={() => setIsMenuOpen(false)}
							>
								<Home className="w-4 h-4" />
								<span className="font-medium">Home</span>
								<ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
							</Link>

							{session?.user && (
								<>
									{/* Dashboard */}
									<Link
										href="/dashboard"
										className={cn(
											"flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors group",
											pathname === "/dashboard" 
												? "bg-primary text-primary-foreground" 
												: "hover:bg-muted text-foreground/70 hover:text-foreground"
										)}
										onClick={() => setIsMenuOpen(false)}
									>
										<LayoutDashboard className="w-4 h-4" />
										<span className="font-medium">Dashboard</span>
										<ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
									</Link>

									{/* New Reservation */}
									<Link
										href="/request"
										className={cn(
											"flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors group",
											pathname === "/request" 
												? "bg-primary text-primary-foreground" 
												: "hover:bg-muted text-foreground/70 hover:text-foreground"
										)}
										onClick={() => setIsMenuOpen(false)}
									>
										<Calendar className="w-4 h-4" />
										<span className="font-medium">New Reservation</span>
										<ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
									</Link>

									{/* Admin Section */}
									{session.user.role === "admin" && (
										<>
											<Separator className="my-4" />
											<div className="px-3 py-2">
												<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
													Administration
												</p>
											</div>
											<Link
												href="/admin"
												className={cn(
													"flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors group",
													pathname === "/admin" 
														? "bg-primary text-primary-foreground" 
														: "hover:bg-muted text-foreground/70 hover:text-foreground"
												)}
												onClick={() => setIsMenuOpen(false)}
											>
												<Settings className="w-4 h-4" />
												<span className="font-medium">Admin Panel</span>
												<ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
											</Link>
										</>
									)}
								</>
							)}
						</div>
					</nav>

					{/* Footer */}
					<div className="p-6 pt-0">
						<div className="text-xs text-muted-foreground text-center">
							© 2025 Reservation System
						</div>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)

	// Desktop navigation
	const DesktopNav = () => (
		<div className="flex">
			<Link href="/" className="flex items-center space-x-3">
				<div className="w-8 h-8 rounded-lg flex items-center justify-center">
					<Image
						src="/logo.svg"
						alt="Reservation System Logo"
						width={32}
						height={32}
						className="w-8 h-8"
					/>
				</div>
				<span className="font-bold text-lg">Reservation System</span>
			</Link>
			{/* <nav className="flex items-center ml-8 space-x-6 text-sm font-medium">
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
						<Link
							href="/request"
							className={cn(
								"transition-colors hover:text-foreground/80",
								pathname === "/request" ? "text-foreground" : "text-foreground/60",
							)}
						>
							New Reservation
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
			</nav> */}
		</div>
	)

	return isMobile ? <MobileMenu /> : <DesktopNav />
}
