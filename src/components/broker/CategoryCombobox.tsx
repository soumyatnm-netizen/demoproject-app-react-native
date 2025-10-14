import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Category {
  id: string;
  name: string;
  is_predefined: boolean;
}

interface CategoryComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function CategoryCombobox({ value, onValueChange, disabled }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coverage_categories')
        .select('id, name, is_predefined')
        .order('is_predefined', { ascending: false })
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (name: string) => {
    try {
      setCreatingNew(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      const { data, error } = await supabase
        .from('coverage_categories')
        .insert({
          name: name.trim(),
          company_id: profile?.company_id || null,
          created_by: user.id,
          is_predefined: false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('A category with this name already exists');
        }
        throw error;
      }

      toast({
        title: "Success",
        description: `Category "${name}" created`,
      });

      // Add to local list and select it
      setCategories(prev => [...prev, data]);
      onValueChange(data.name);
      setOpen(false);
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to create category",
        variant: "destructive",
      });
    } finally {
      setCreatingNew(false);
    }
  };

  const selectedCategory = categories.find(cat => cat.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedCategory ? selectedCategory.name : "Select category..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search or create category..." />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-center">
                <p className="text-sm text-muted-foreground mb-2">No category found.</p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
                    if (input?.value) {
                      createCategory(input.value);
                    }
                  }}
                  disabled={creatingNew}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create new
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup heading="Categories">
              {categories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.name}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === category.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {category.name}
                  {!category.is_predefined && (
                    <span className="ml-auto text-xs text-muted-foreground">Custom</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
