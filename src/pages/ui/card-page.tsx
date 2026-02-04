import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptionButton } from "./ui-shared";

export function CardPage() {
  const [showHeader, setShowHeader] = useState(true);
  const [showDescription, setShowDescription] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showAction, setShowAction] = useState(true);

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Card Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Header</span>
              <div className="flex gap-8">
                <OptionButton label="Show" selected={showHeader} onClick={() => setShowHeader(true)} />
                <OptionButton label="Hide" selected={!showHeader} onClick={() => setShowHeader(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Description</span>
              <div className="flex gap-8">
                <OptionButton label="Show" selected={showDescription} onClick={() => setShowDescription(true)} />
                <OptionButton label="Hide" selected={!showDescription} onClick={() => setShowDescription(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Footer</span>
              <div className="flex gap-8">
                <OptionButton label="Show" selected={showFooter} onClick={() => setShowFooter(true)} />
                <OptionButton label="Hide" selected={!showFooter} onClick={() => setShowFooter(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Action</span>
              <div className="flex gap-8">
                <OptionButton label="Show" selected={showAction} onClick={() => setShowAction(true)} />
                <OptionButton label="Hide" selected={!showAction} onClick={() => setShowAction(false)} />
              </div>
            </div>
          </div>

          <div className="flex items-start justify-center p-32 bg-white rounded-small border border-gray-200">
            <Card className="w-[380px]">
              {showHeader && (
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  {showDescription && (
                    <CardDescription>Card description goes here</CardDescription>
                  )}
                  {showAction && (
                    <CardAction>
                      <Button size="sm" buttonStyle="secondary">Action</Button>
                    </CardAction>
                  )}
                </CardHeader>
              )}
              <CardContent>
                <p className="text-body-m text-text-secondary">
                  This is the card content area. You can put any content here including text, images, forms, and more.
                </p>
              </CardContent>
              {showFooter && (
                <CardFooter className="gap-8">
                  <Button buttonStyle="secondary" size="sm">Cancel</Button>
                  <Button size="sm">Save</Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">Card - Examples</h2>
        <div className="grid grid-cols-2 gap-24">
          <Card>
            <CardHeader>
              <CardTitle>Simple Card</CardTitle>
              <CardDescription>A basic card with title and description</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-body-s text-text-secondary">Content goes here</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>With Border</CardTitle>
              <CardDescription>Header with bottom border</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-body-s text-text-secondary">Content goes here</p>
            </CardContent>
            <CardFooter className="border-t">
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>With Action</CardTitle>
              <CardAction>
                <Button size="sm" buttonStyle="ghost">Edit</Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-body-s text-text-secondary">Card with header action button</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-24">
              <div className="text-center">
                <p className="text-h4 font-bold">Content Only</p>
                <p className="text-body-s text-text-secondary mt-8">Card without header or footer</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
