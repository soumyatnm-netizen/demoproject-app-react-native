import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, BookOpen, DollarSign, MapPin, TrendingUp, AlertCircle, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BatchProcessAppetites } from "./BatchProcessAppetites";

interface AppetiteGuide {
  id: string;
  underwriter_name: string;
  document_type: string;
  status: string;
  logo_url: string | null;
  created_at: string;
  coverage_category?: string | null;
  appetite_data: {
    target_sectors: string[];
    financial_ratings: any;
    coverage_limits: any;
    minimum_premium: number | null;
    maximum_premium: number | null;
    risk_appetite: string;
    geographic_coverage: string[];
    specialty_focus: string[];
    policy_features: any;
    exclusions: string[];
  } | null;
}

type CoverageCategory = 'all' | string;

interface Category {
  id: string;
  name: string;
  is_predefined: boolean;
}

const AppetiteGuidesViewer = () => {
  const [appetiteGuides, setAppetiteGuides] = useState<AppetiteGuide[]>([]);
  const [filteredGuides, setFilteredGuides] = useState<AppetiteGuide[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CoverageCategory>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchAppetiteGuides();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('coverage_categories')
        .select('id, name, is_predefined')
        .order('is_predefined', { ascending: false })
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    // Filter guides based on search term and category
    let filtered = appetiteGuides;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(guide => {
        // First check if guide has a coverage_category that matches
        if (guide.coverage_category === selectedCategory) {
          return true;
        }
        
        // Fallback to keyword matching for guides without explicit category
        const categoryKeywords = getCategoryKeywords(selectedCategory);
        if (categoryKeywords.length === 0) return false;
        
        return (
          guide.appetite_data?.target_sectors?.some(sector => 
            categoryKeywords.some(keyword => 
              sector.toLowerCase().includes(keyword.toLowerCase())
            )
          ) ||
          guide.appetite_data?.specialty_focus?.some(focus => 
            categoryKeywords.some(keyword => 
              focus.toLowerCase().includes(keyword.toLowerCase())
            )
          )
        );
      });
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(guide =>
        guide.underwriter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guide.appetite_data?.target_sectors?.some(sector => 
          sector.toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        guide.appetite_data?.specialty_focus?.some(focus => 
          focus.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    setFilteredGuides(filtered);
  }, [searchTerm, selectedCategory, appetiteGuides]);

  const getCategoryKeywords = (category: CoverageCategory): string[] => {
    // Only use keyword matching for predefined categories
    switch (category) {
      case 'Tech and Life Sciences':
        return ['tech', 'technology', 'life sciences', 'biotech', 'pharma', 'pharmaceutical', 'software', 'saas', 'it'];
      case 'Commercial Combined':
        return ['commercial', 'combined', 'package', 'business', 'sme', 'property', 'liability'];
      case 'Cyber':
        return ['cyber', 'data', 'privacy', 'breach', 'ransomware', 'information security'];
      default:
        return []; // For custom categories, rely only on exact match
    }
  };

  const fetchAppetiteGuides = async () => {
    try {
      setLoading(true);

      const { data: guides, error } = await supabase
        .from('underwriter_appetites')
        .select(`
          id,
          underwriter_name,
          document_type,
          status,
          logo_url,
          created_at,
          coverage_category,
          appetite_data:underwriter_appetite_data(*)
        `)
        .eq('status', 'processed')
        .order('underwriter_name');

      if (error) throw error;

      // Transform the data to match our interface
      const transformedGuides = guides?.map(guide => ({
        ...guide,
        appetite_data: guide.appetite_data?.[0] || null
      })) || [];

      setAppetiteGuides(transformedGuides);
      setFilteredGuides(transformedGuides);

    } catch (error) {
      console.error('Error fetching appetite guides:', error);
      toast({
        title: "Error",
        description: "Failed to load appetite guides",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPremiumRange = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not specified";
    if (min && max) return `£${min.toLocaleString()} - £${max.toLocaleString()}`;
    if (min) return `From £${min.toLocaleString()}`;
    if (max) return `Up to £${max.toLocaleString()}`;
    return "Not specified";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Batch Processing Section */}
      <BatchProcessAppetites />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Underwriter Appetite Guides</h2>
          <p className="text-muted-foreground">
            Browse available underwriter appetites and risk criteria
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {filteredGuides.length} guides available
          </Badge>
          <div className="text-xs text-muted-foreground">
            Contact your administrator to upload new guides
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as CoverageCategory)}>
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <TabsTrigger value="all">All Guides</TabsTrigger>
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.name}>
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by underwriter, sector, or specialty..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Appetite Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredGuides.map((guide) => (
          <Card key={guide.id} className="h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {guide.logo_url ? (
                    <img 
                      src={guide.logo_url} 
                      alt={`${guide.underwriter_name} logo`}
                      className="h-10 w-10 object-contain"
                    />
                  ) : (
                    <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{guide.underwriter_name}</CardTitle>
                    <CardDescription>
                      {guide.appetite_data?.risk_appetite || "Risk appetite not specified"}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline">
                  {guide.document_type.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Target Sectors */}
              {guide.appetite_data?.target_sectors && guide.appetite_data.target_sectors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Target Sectors
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {guide.appetite_data.target_sectors?.slice(0, 3).map((sector, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {sector}
                      </Badge>
                    ))}
                    {guide.appetite_data.target_sectors && guide.appetite_data.target_sectors.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{guide.appetite_data.target_sectors.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Premium Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Premium Range
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {formatPremiumRange(guide.appetite_data?.minimum_premium, guide.appetite_data?.maximum_premium)}
                  </p>
                </div>

                {/* Geographic Coverage */}
                <div>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Coverage
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {guide.appetite_data?.geographic_coverage?.length 
                      ? `${guide.appetite_data.geographic_coverage.length} regions`
                      : "Not specified"
                    }
                  </p>
                </div>
              </div>

              {/* Specialty Focus */}
              {guide.appetite_data?.specialty_focus && guide.appetite_data.specialty_focus.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Specialty Focus
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {guide.appetite_data.specialty_focus?.slice(0, 2).map((focus, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {focus}
                      </Badge>
                    ))}
                    {guide.appetite_data.specialty_focus && guide.appetite_data.specialty_focus.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{guide.appetite_data.specialty_focus.length - 2} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Financial Rating */}
              {guide.appetite_data?.financial_ratings && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Financial Rating</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">
                      {typeof guide.appetite_data.financial_ratings === 'object' 
                        ? Object.values(guide.appetite_data.financial_ratings)[0] || 'Not rated'
                        : guide.appetite_data.financial_ratings || 'Not rated'
                      }
                    </Badge>
                  </div>
                </div>
              )}

              {/* Exclusions Warning */}
              {guide.appetite_data?.exclusions && guide.appetite_data.exclusions.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">
                      {guide.appetite_data.exclusions.length} exclusions apply
                    </span>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2">
                Last updated: {new Date(guide.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredGuides.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'No matching appetite guides found' : 'No appetite guides available'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || selectedCategory !== 'all'
                ? 'Try adjusting your search terms or category filter'
                : 'Appetite guides will appear here once uploaded by administrators'
              }
            </p>
            {(searchTerm || selectedCategory !== 'all') && (
              <div className="flex gap-2 justify-center">
                {searchTerm && (
                  <Button variant="outline" onClick={() => setSearchTerm('')}>
                    Clear Search
                  </Button>
                )}
                {selectedCategory !== 'all' && (
                  <Button variant="outline" onClick={() => setSelectedCategory('all')}>
                    View All Categories
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AppetiteGuidesViewer;