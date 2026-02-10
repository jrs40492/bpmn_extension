# DMN Editor - Decision Model and Notation Features

Welcome to the enhanced DMN (Decision Model and Notation) Editor! This VS Code extension provides a comprehensive set of tools for creating, editing, and testing DMN decision models with advanced features specifically designed for business decision management.

## 🌟 Overview

This DMN Editor extends the standard BPMN extension with powerful DMN-specific capabilities that go beyond basic diagram editing. It provides a complete decision modeling environment with testing, validation, and analysis tools.

## 🚀 Key Features

### 1. 🧪 **Decision Testing & Simulation**
**The most requested DMN feature!**

Test your decision tables with real data and see exactly which rules fire.

#### Features:
- **Interactive Input Panel**: Enter test values for all input columns
- **Rule Execution Tracing**: See which rules matched your inputs
- **Output Visualization**: View the final decision results
- **Hit Policy Support**: Works with UNIQUE, FIRST, COLLECT, and other hit policies
- **Real-time Evaluation**: Instant feedback as you modify inputs

#### Usage:
1. Open a DMN file with decision tables
2. Click the **🧪 Test** button in the toolbar
3. Enter input values in the side panel
4. Click **▶ Evaluate** to see results
5. View matched rules and final outputs

#### Example:
```
Input: Customer Type = "VIP", Order Amount = 1500
Result: Discount = 20% (Rule 3 matched)
Execution Path: Rule 3 → 20% discount
```

### 2. 🤖 **Enhanced FEEL Expression Support**
**Comprehensive FEEL (Friendly Enough Expression Language) integration**

#### Features:
- **Syntax Validation**: Real-time validation of FEEL expressions
- **Type Checking**: Inline type validation for expressions
- **Function Reference**: Built-in documentation for 50+ FEEL functions
- **Expression Analysis**: Categorize expressions (literal, comparison, range, etc.)
- **Error Reporting**: Detailed syntax and semantic error messages

#### FEEL Function Categories:
- **Conversion Functions**: `number()`, `string()`, `date()`, `time()`
- **String Functions**: `substring()`, `contains()`, `starts with()`, `matches()`
- **List Functions**: `list contains()`, `count()`, `min()`, `max()`, `sum()`
- **Boolean Functions**: `not()`, `all()`, `any()`
- **Numeric Functions**: `abs()`, `ceiling()`, `floor()`, `round()`
- **Context Functions**: `get value()`, `get entries()`

#### Example Expressions:
```feel
# Range expressions
[1..10], (0..100)

# List expressions  
"approved", "pending", "rejected"

# Comparisons
< 1000, >= 18, != null

# Function calls
substring(name, 1, 5)
list contains(["red", "green", "blue"], color)
```

### 3. 📊 **Rule Analysis & Validation**
**Advanced decision table analysis for quality assurance**

#### Features:
- **Conflict Detection**: Identify overlapping rules that could produce ambiguous results
- **Completeness Analysis**: Find gaps in rule coverage
- **Dead Rule Detection**: Identify unreachable or redundant rules
- **Input Domain Analysis**: Analyze input value ranges and suggest missing combinations
- **Coverage Metrics**: Quantify decision table completeness

#### Analysis Types:

**🔴 Conflicts (Overlapping Rules)**
```
⚠️ Rules 3 and 5 both match when:
   Status = "active" AND Amount > 1000
   
Suggestion: Add more specific conditions or merge rules
```

**🟡 Gaps (Missing Coverage)**
```
⚠️ No rule covers:
   Status = "pending" AND Amount > 5000
   
Suggestion: Add rule for pending high-value cases
```

**🔵 Unreachable Rules**
```
ℹ️ Rule 7 is never reached because:
   Rule 2 always matches first with broader conditions
```

#### Completeness Scoring:
- **Good (90-100%)**: ✅ Comprehensive coverage
- **Moderate (70-89%)**: ⚠️ Some gaps exist  
- **Poor (<70%)**: ❌ Significant coverage issues

### 4. 🔍 **Smart Search & Navigation**
**Quickly find and navigate to any element in your DMN model**

#### Features:
- **Universal Search**: Search across all DMN elements (decisions, inputs, knowledge sources)
- **Type-specific Icons**: Visual identification of element types
- **Quick Navigation**: Click to jump directly to elements
- **Keyboard Shortcuts**: `Ctrl/Cmd + F` to open search
- **Real-time Results**: Instant search as you type

#### Searchable Elements:
- 📋 **Decisions**: Business decision points
- 📥 **Input Data**: External data sources
- 📚 **Knowledge Sources**: Business knowledge references
- 🧠 **Business Knowledge Models**: Reusable decision logic
- ⚙️ **Decision Services**: Encapsulated decision units

### 5. 📋 **Test Case Management**
**Save, organize, and execute comprehensive test suites**

#### Features:
- **Persistent Test Cases**: Save test scenarios for regression testing
- **Batch Execution**: Run multiple test cases at once
- **Test Metadata**: Names, descriptions, and creation dates
- **Expected vs Actual**: Compare expected outputs with results
- **Test History**: Track test execution over time

#### Test Case Structure:
```json
{
  "name": "VIP Customer Large Order",
  "description": "Test discount for VIP customers with orders > $1000",
  "inputs": {
    "customerType": "VIP",
    "orderAmount": 1500,
    "loyaltyYears": 3
  },
  "expectedOutputs": {
    "discount": 0.20,
    "expeditedShipping": true
  }
}
```

#### Usage Workflow:
1. **Create**: Enter test inputs and click **💾 Save Test**
2. **Organize**: Add names and descriptions for clarity
3. **Execute**: Click **📋 Test Cases** to view and run saved tests
4. **Compare**: Review results against expected outcomes
5. **Maintain**: Update tests as business rules evolve

## 🎯 Getting Started

### Opening DMN Files
1. Install the BPMN extension in VS Code
2. Open any `.dmn` file
3. The DMN editor will automatically launch with all features available

### Basic Workflow
1. **Design**: Create your decision model using the DRD (Decision Requirements Diagram)
2. **Define**: Edit decision tables with input/output columns and rules
3. **Test**: Use the testing panel to validate your decisions with sample data
4. **Analyze**: Run rule analysis to check for conflicts and gaps
5. **Refine**: Improve your model based on analysis results

### Keyboard Shortcuts
- `Ctrl/Cmd + F`: Open search panel
- `Ctrl/Cmd + Z`: Undo changes
- `Ctrl/Cmd + Y`: Redo changes

## 🔧 Technical Implementation

### FEEL Expression Engine
- **Parser**: Uses `feelin` library for Drools-compatible FEEL parsing
- **Validation**: Real-time syntax and semantic checking
- **Evaluation**: Context-aware expression evaluation with variable substitution

### Decision Testing Engine
- **Rule Matching**: Implements proper DMN semantics for rule evaluation
- **Hit Policy Support**: Handles UNIQUE, FIRST, COLLECT, and other standard hit policies
- **Context Management**: Maintains evaluation context throughout rule execution
- **Error Handling**: Graceful handling of malformed expressions and data

### Rule Analysis Engine
- **Overlap Detection**: Uses constraint satisfaction techniques to find rule conflicts
- **Gap Analysis**: Generates input space coverage maps to identify missing rules
- **Reachability Analysis**: Performs dependency analysis to find dead rules

## 🎨 Visual Features

### Professional UI
- **VS Code Theming**: Fully integrated with VS Code's theme system
- **Dark/Light Mode**: Automatic adaptation to editor themes
- **Responsive Design**: Panels resize and adapt to different screen sizes
- **Accessible Icons**: Clear visual indicators for all features

### Interactive Elements
- **Floating Panels**: Non-intrusive panels that don't block diagram editing
- **Resizable Components**: Adjust panel sizes to fit your workflow
- **Keyboard Navigation**: Full keyboard accessibility for all features
- **Toast Notifications**: Subtle feedback for user actions

## 📊 Use Cases

### Business Analysts
- **Decision Documentation**: Create clear, executable business rules
- **Impact Analysis**: Understand how input changes affect decisions
- **Rule Validation**: Ensure comprehensive coverage of business scenarios

### Developers
- **Logic Testing**: Validate decision logic before implementation
- **Integration Preparation**: Export tested decisions for system integration
- **Regression Testing**: Maintain test suites for decision model changes

### Quality Assurance
- **Coverage Analysis**: Ensure all business scenarios are handled
- **Conflict Resolution**: Identify and resolve contradictory rules
- **Test Automation**: Create reusable test cases for continuous validation

## 🚀 Advanced Features

### Custom Extensions
The editor supports custom extensions for:
- Additional FEEL functions
- Custom validation rules
- Integration with external data sources
- Custom rule analysis algorithms

### Export Options
- **DMN XML**: Standard DMN format for tool interoperability
- **Test Reports**: Comprehensive test execution reports
- **Analysis Reports**: Rule analysis and coverage reports

## 🔮 Future Enhancements

Planned improvements include:
- **Performance Optimization**: Faster rule analysis for large decision tables
- **Advanced Visualizations**: Graphical coverage maps and decision flows
- **Integration APIs**: REST endpoints for external tool integration
- **Collaborative Features**: Multi-user editing and commenting
- **Version Control**: Built-in change tracking and branching

## 📝 Contributing

This DMN editor is part of the broader BPMN extension ecosystem. Contributions are welcome for:
- New FEEL functions
- Additional analysis algorithms  
- UI/UX improvements
- Performance optimizations
- Documentation enhancements

## 📄 License

This DMN editor follows the same licensing terms as the parent BPMN extension project.

---

*Transform your business decisions into executable, testable, and maintainable decision models with the power of DMN!* 🎯