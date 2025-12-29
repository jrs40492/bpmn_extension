/**
 * BPMN Templates Feature
 * Pre-built templates for common process patterns
 */

export interface BpmnTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'approval' | 'integration' | 'error-handling';
  icon: string;
  xml: string;
}

// Template definitions
export const templates: BpmnTemplate[] = [
  {
    id: 'simple-sequence',
    name: 'Simple Sequence',
    description: 'Basic start to end flow with one task',
    category: 'basic',
    icon: '➡️',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_1" name="Do Something">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_1" name="End">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="270" y="138" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="422" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="216" y="178" />
        <di:waypoint x="270" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="370" y="178" />
        <di:waypoint x="422" y="178" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'approval-workflow',
    name: 'Approval Workflow',
    description: 'Request with approval/rejection decision',
    category: 'approval',
    icon: '✅',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Request Submitted">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_Review" name="Review Request">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_Decision" name="Approved?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_Approved</bpmn:outgoing>
      <bpmn:outgoing>Flow_Rejected</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:task id="Task_Process" name="Process Request">
      <bpmn:incoming>Flow_Approved</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_Notify" name="Notify Rejection">
      <bpmn:incoming>Flow_Rejected</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_Approved" name="Approved">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_Rejected" name="Rejected">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_Review" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Review" targetRef="Gateway_Decision" />
    <bpmn:sequenceFlow id="Flow_Approved" name="Yes" sourceRef="Gateway_Decision" targetRef="Task_Process" />
    <bpmn:sequenceFlow id="Flow_Rejected" name="No" sourceRef="Gateway_Decision" targetRef="Task_Notify" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_Process" targetRef="End_Approved" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_Notify" targetRef="End_Rejected" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="180" y="180" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Review_di" bpmnElement="Task_Review">
        <dc:Bounds x="270" y="158" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Decision_di" bpmnElement="Gateway_Decision" isMarkerVisible="true">
        <dc:Bounds x="425" y="173" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Process_di" bpmnElement="Task_Process">
        <dc:Bounds x="530" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Notify_di" bpmnElement="Task_Notify">
        <dc:Bounds x="530" y="220" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Approved_di" bpmnElement="End_Approved">
        <dc:Bounds x="682" y="122" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Rejected_di" bpmnElement="End_Rejected">
        <dc:Bounds x="682" y="242" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="216" y="198" />
        <di:waypoint x="270" y="198" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="370" y="198" />
        <di:waypoint x="425" y="198" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Approved_di" bpmnElement="Flow_Approved">
        <di:waypoint x="450" y="173" />
        <di:waypoint x="450" y="140" />
        <di:waypoint x="530" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Rejected_di" bpmnElement="Flow_Rejected">
        <di:waypoint x="450" y="223" />
        <di:waypoint x="450" y="260" />
        <di:waypoint x="530" y="260" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="630" y="140" />
        <di:waypoint x="682" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="630" y="260" />
        <di:waypoint x="682" y="260" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'parallel-split',
    name: 'Parallel Split',
    description: 'Execute multiple tasks in parallel',
    category: 'basic',
    icon: '⚡',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:parallelGateway id="Gateway_Split" name="Split">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_A</bpmn:outgoing>
      <bpmn:outgoing>Flow_B</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:task id="Task_A" name="Task A">
      <bpmn:incoming>Flow_A</bpmn:incoming>
      <bpmn:outgoing>Flow_A2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_B" name="Task B">
      <bpmn:incoming>Flow_B</bpmn:incoming>
      <bpmn:outgoing>Flow_B2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:parallelGateway id="Gateway_Join" name="Join">
      <bpmn:incoming>Flow_A2</bpmn:incoming>
      <bpmn:incoming>Flow_B2</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:endEvent id="End_1" name="End">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Gateway_Split" />
    <bpmn:sequenceFlow id="Flow_A" sourceRef="Gateway_Split" targetRef="Task_A" />
    <bpmn:sequenceFlow id="Flow_B" sourceRef="Gateway_Split" targetRef="Task_B" />
    <bpmn:sequenceFlow id="Flow_A2" sourceRef="Task_A" targetRef="Gateway_Join" />
    <bpmn:sequenceFlow id="Flow_B2" sourceRef="Task_B" targetRef="Gateway_Join" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Gateway_Join" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="180" y="180" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Split_di" bpmnElement="Gateway_Split">
        <dc:Bounds x="265" y="173" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_A_di" bpmnElement="Task_A">
        <dc:Bounds x="370" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_B_di" bpmnElement="Task_B">
        <dc:Bounds x="370" y="220" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Join_di" bpmnElement="Gateway_Join">
        <dc:Bounds x="525" y="173" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="622" y="180" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="216" y="198" />
        <di:waypoint x="265" y="198" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_A_di" bpmnElement="Flow_A">
        <di:waypoint x="290" y="173" />
        <di:waypoint x="290" y="140" />
        <di:waypoint x="370" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_B_di" bpmnElement="Flow_B">
        <di:waypoint x="290" y="223" />
        <di:waypoint x="290" y="260" />
        <di:waypoint x="370" y="260" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_A2_di" bpmnElement="Flow_A2">
        <di:waypoint x="470" y="140" />
        <di:waypoint x="550" y="140" />
        <di:waypoint x="550" y="173" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_B2_di" bpmnElement="Flow_B2">
        <di:waypoint x="470" y="260" />
        <di:waypoint x="550" y="260" />
        <di:waypoint x="550" y="223" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="575" y="198" />
        <di:waypoint x="622" y="198" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'error-boundary',
    name: 'Error Handling',
    description: 'Task with error boundary event',
    category: 'error-handling',
    icon: '⚠️',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="Task_Risky" name="Risky Operation">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="Error_Boundary" name="Error" attachedToRef="Task_Risky">
      <bpmn:outgoing>Flow_Error</bpmn:outgoing>
      <bpmn:errorEventDefinition id="ErrorEventDef_1" />
    </bpmn:boundaryEvent>
    <bpmn:task id="Task_Handle" name="Handle Error">
      <bpmn:incoming>Flow_Error</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_Success" name="Success">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_Error" name="Error Handled">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_Risky" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Risky" targetRef="End_Success" />
    <bpmn:sequenceFlow id="Flow_Error" sourceRef="Error_Boundary" targetRef="Task_Handle" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_Handle" targetRef="End_Error" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Risky_di" bpmnElement="Task_Risky">
        <dc:Bounds x="270" y="138" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Error_Boundary_di" bpmnElement="Error_Boundary">
        <dc:Bounds x="332" y="200" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Handle_di" bpmnElement="Task_Handle">
        <dc:Bounds x="370" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Success_di" bpmnElement="End_Success">
        <dc:Bounds x="422" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Error_di" bpmnElement="End_Error">
        <dc:Bounds x="522" y="282" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="216" y="178" />
        <di:waypoint x="270" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="370" y="178" />
        <di:waypoint x="422" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Error_di" bpmnElement="Flow_Error">
        <di:waypoint x="350" y="236" />
        <di:waypoint x="350" y="300" />
        <di:waypoint x="370" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="470" y="300" />
        <di:waypoint x="522" y="300" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'timer-loop',
    name: 'Timer Loop',
    description: 'Recurring task with timer',
    category: 'integration',
    icon: '🔄',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_Poll" name="Poll for Updates">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:incoming>Flow_Loop</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:exclusiveGateway id="Gateway_Check" name="Updates Found?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_Yes</bpmn:outgoing>
      <bpmn:outgoing>Flow_No</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:intermediateCatchEvent id="Timer_Wait" name="Wait 5 min">
      <bpmn:incoming>Flow_No</bpmn:incoming>
      <bpmn:outgoing>Flow_Loop</bpmn:outgoing>
      <bpmn:timerEventDefinition id="TimerEventDef_1" />
    </bpmn:intermediateCatchEvent>
    <bpmn:task id="Task_Process" name="Process Updates">
      <bpmn:incoming>Flow_Yes</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_1" name="Done">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_Poll" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Poll" targetRef="Gateway_Check" />
    <bpmn:sequenceFlow id="Flow_Yes" name="Yes" sourceRef="Gateway_Check" targetRef="Task_Process" />
    <bpmn:sequenceFlow id="Flow_No" name="No" sourceRef="Gateway_Check" targetRef="Timer_Wait" />
    <bpmn:sequenceFlow id="Flow_Loop" sourceRef="Timer_Wait" targetRef="Task_Poll" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_Process" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Poll_di" bpmnElement="Task_Poll">
        <dc:Bounds x="270" y="138" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Check_di" bpmnElement="Gateway_Check" isMarkerVisible="true">
        <dc:Bounds x="425" y="153" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Timer_Wait_di" bpmnElement="Timer_Wait">
        <dc:Bounds x="432" y="272" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Process_di" bpmnElement="Task_Process">
        <dc:Bounds x="530" y="138" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="682" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="216" y="178" />
        <di:waypoint x="270" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="370" y="178" />
        <di:waypoint x="425" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Yes_di" bpmnElement="Flow_Yes">
        <di:waypoint x="475" y="178" />
        <di:waypoint x="530" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_No_di" bpmnElement="Flow_No">
        <di:waypoint x="450" y="203" />
        <di:waypoint x="450" y="272" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Loop_di" bpmnElement="Flow_Loop">
        <di:waypoint x="432" y="290" />
        <di:waypoint x="320" y="290" />
        <di:waypoint x="320" y="218" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="630" y="178" />
        <di:waypoint x="682" y="178" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  },
  {
    id: 'subprocess',
    name: 'Subprocess',
    description: 'Embedded subprocess pattern',
    category: 'basic',
    icon: '📦',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:subProcess id="SubProcess_1" name="Sub Process">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
      <bpmn:startEvent id="Sub_Start" name="Sub Start">
        <bpmn:outgoing>Sub_Flow_1</bpmn:outgoing>
      </bpmn:startEvent>
      <bpmn:task id="Sub_Task" name="Sub Task">
        <bpmn:incoming>Sub_Flow_1</bpmn:incoming>
        <bpmn:outgoing>Sub_Flow_2</bpmn:outgoing>
      </bpmn:task>
      <bpmn:endEvent id="Sub_End" name="Sub End">
        <bpmn:incoming>Sub_Flow_2</bpmn:incoming>
      </bpmn:endEvent>
      <bpmn:sequenceFlow id="Sub_Flow_1" sourceRef="Sub_Start" targetRef="Sub_Task" />
      <bpmn:sequenceFlow id="Sub_Flow_2" sourceRef="Sub_Task" targetRef="Sub_End" />
    </bpmn:subProcess>
    <bpmn:endEvent id="End_1" name="End">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="SubProcess_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="SubProcess_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="180" y="200" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubProcess_1_di" bpmnElement="SubProcess_1" isExpanded="true">
        <dc:Bounds x="270" y="120" width="300" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_Start_di" bpmnElement="Sub_Start">
        <dc:Bounds x="290" y="202" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_Task_di" bpmnElement="Sub_Task">
        <dc:Bounds x="370" y="180" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_End_di" bpmnElement="Sub_End">
        <dc:Bounds x="512" y="202" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Sub_Flow_1_di" bpmnElement="Sub_Flow_1">
        <di:waypoint x="326" y="220" />
        <di:waypoint x="370" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Sub_Flow_2_di" bpmnElement="Sub_Flow_2">
        <di:waypoint x="470" y="220" />
        <di:waypoint x="512" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="622" y="200" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="216" y="218" />
        <di:waypoint x="270" y="218" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="570" y="218" />
        <di:waypoint x="622" y="218" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  }
];

// Template panel initialization
export function initTemplatesPanel(
  onSelectTemplate: (xml: string) => void
): { show: () => void; hide: () => void } {
  const panel = createTemplatesPanelHTML();
  document.body.appendChild(panel);

  const closeButton = panel.querySelector('.templates-panel-close') as HTMLButtonElement;
  const templateItems = panel.querySelectorAll('.template-item');

  closeButton.addEventListener('click', () => {
    panel.classList.remove('visible');
  });

  templateItems.forEach((item) => {
    item.addEventListener('click', () => {
      const templateId = item.getAttribute('data-template-id');
      const template = templates.find(t => t.id === templateId);
      if (template) {
        onSelectTemplate(template.xml);
        panel.classList.remove('visible');
      }
    });
  });

  return {
    show: () => panel.classList.add('visible'),
    hide: () => panel.classList.remove('visible')
  };
}

function createTemplatesPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'templates-panel';
  panel.className = 'templates-panel';

  const categories = [
    { id: 'basic', name: 'Basic Patterns' },
    { id: 'approval', name: 'Approval Workflows' },
    { id: 'integration', name: 'Integration Patterns' },
    { id: 'error-handling', name: 'Error Handling' }
  ];

  let templatesHTML = '';
  for (const category of categories) {
    const categoryTemplates = templates.filter(t => t.category === category.id);
    if (categoryTemplates.length > 0) {
      templatesHTML += `<div class="template-category">
        <div class="template-category-header">${category.name}</div>
        <div class="template-list">
          ${categoryTemplates.map(t => `
            <div class="template-item" data-template-id="${t.id}">
              <span class="template-icon">${t.icon}</span>
              <div class="template-info">
                <div class="template-name">${t.name}</div>
                <div class="template-description">${t.description}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }
  }

  panel.innerHTML = `
    <div class="templates-panel-header">
      <span class="templates-panel-icon">📋</span>
      <span class="templates-panel-title">BPMN Templates</span>
      <button class="templates-panel-close" title="Close">&times;</button>
    </div>
    <div class="templates-panel-body">
      ${templatesHTML}
    </div>
  `;

  return panel;
}
